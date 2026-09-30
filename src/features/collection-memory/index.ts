import { watchDom, whenBody } from '@/core/dom';
import { instantResponse, net, type NetRequest } from '@/core/net';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { markRestored } from '@/services/collection-restore';
import {
  COLLECTION_ROUTE,
  findCollectionFilters,
  findCollectionSearchField,
  findCollectionSelect,
  findRarityPills,
  isCollectionList,
  isCollectionStats,
  readCollectionQuery,
  sameFilters,
  UNTAGGED_OPTION,
  withCollectionFilters,
  type CollectionQuery,
} from '@/site/collection';
import { savedFilters, toSaved } from './memory';

type Kind = 'list' | 'stats';

interface Cached {
  readonly body: string;
  readonly contentType: string;
}

/** Délai pour remettre les contrôles du site aux filtres retenus (recherche comprise : 300 ms), après quoi on lâche. */
const RESTORE_TIMEOUT = 3000;
/**
 * Contrôles remis : les requêtes aux filtres retenus qui suivent encore sont servies elles aussi (plusieurs
 * rendus de la page, un par priorité de mise à jour, peuvent chacun relancer la liste).
 */
const SETTLE_DELAY = 500;

const isCollectionRequest = (request: NetRequest) => !request.own && (isCollectionList(request) || isCollectionStats(request));

/**
 * - `arrival` : aucune requête encore ; la première dit si la page part d'autres filtres que ceux retenus ;
 * - `first` : la requête par défaut (compteurs puis liste, dans la même tâche) part avec les filtres retenus ;
 * - `controls` : on attend la grille pour remettre les contrôles du site, dont chaque requête reçoit la réponse
 *   déjà chargée, jusqu'à celle qui a tous les filtres retenus.
 */
type Phase = 'arrival' | 'first' | 'controls';

/**
 * Retient les filtres de la dernière liste chargée (tri, étiquette, raretés, recherche) et y revient à
 * l'arrivée sur la page : la requête par défaut ne part pas, la liste et ses compteurs sont chargés avec les
 * filtres retenus ; une fois la grille affichée, les contrôles du site (listes, pastilles, champ de recherche)
 * y sont remis, leurs requêtes servies sans réseau. La page revient en page 1.
 */
export const collectionMemory: Feature = {
  id: 'collection-memory',
  name: 'Filtres retenus',
  description: "À l'arrivée sur la collection, la liste revient aux filtres de la dernière recherche.",
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    const saved = savedFilters.get();
    let restore: { readonly target: CollectionQuery; phase: Phase; applied: boolean; settled: boolean } | undefined = saved
      ? { target: { ...saved, page: undefined }, phase: 'arrival', applied: false, settled: false }
      : undefined;
    const cached: Partial<Record<Kind, Cached>> = {};
    /** Chargement de la liste avec les filtres retenus : les requêtes suivantes l'attendent. */
    let loaded: Promise<boolean> | undefined;
    const plans = new WeakMap<NetRequest, 'fetch' | 'serve'>();
    let latestList: NetRequest | undefined;
    let timer: number | undefined;

    function finish(reason: string): void {
      if (!restore) return;
      log.debug('filtres retenus :', reason);
      restore = undefined;
      clearTimeout(timer);
    }
    signal.addEventListener('abort', () => clearTimeout(timer), { once: true });

    net.track(
      isCollectionRequest,
      (request) => {
        const kind: Kind = isCollectionList(request) ? 'list' : 'stats';
        if (kind === 'list') latestList = request;
        if (!restore) return undefined;
        const query = readCollectionQuery(request.url);
        if (restore.phase === 'arrival') {
          if (sameFilters(query, restore.target)) {
            finish('la page part déjà de ces filtres');
            return undefined;
          }
          restore.phase = 'first';
        }
        const reached = sameFilters(query, restore.target);
        // Contrôles déjà remis : un autre filtre vient de l'utilisateur, il charge normalement.
        if (restore.settled && !reached) {
          finish('nouveau filtre');
          return undefined;
        }
        markRestored(request, restore.target);
        if (restore.phase === 'first') {
          plans.set(request, 'fetch');
          if (kind === 'list') restore.phase = 'controls';
          return undefined;
        }
        plans.set(request, 'serve');
        if (kind === 'list' && reached && !restore.settled) {
          restore.settled = true;
          clearTimeout(timer);
          timer = window.setTimeout(() => finish('contrôles remis'), SETTLE_DELAY);
        }
        return undefined;
      },
      { signal },
    );

    async function fetchRestored(request: NetRequest, kind: Kind, target: CollectionQuery): Promise<Response> {
      const response = await net.fetch(withCollectionFilters(request.url, target).href);
      if (response.ok) {
        cached[kind] = { body: await response.clone().text(), contentType: response.headers.get('content-type') ?? 'application/json' };
      } else if (kind === 'list') {
        finish(`chargement en échec (${response.status})`);
      }
      return response;
    }

    net.intercept(
      isCollectionRequest,
      async (request) => {
        const plan = plans.get(request);
        if (!plan) return undefined;
        const kind: Kind = isCollectionList(request) ? 'list' : 'stats';
        if (plan === 'fetch') {
          const target = restore?.target ?? readCollectionQuery(request.url);
          const fetched = fetchRestored(request, kind, target);
          if (kind === 'list') loaded = fetched.then((response) => response.ok, () => false);
          try {
            return await fetched;
          } catch (error) {
            if (kind === 'list') finish('chargement en échec (réseau)');
            throw error;
          }
        }
        if (!(await loaded)) return undefined;
        const reply = cached[kind];
        return reply ? instantResponse(reply.body, { status: 200, headers: { 'content-type': reply.contentType } }) : undefined;
      },
      { signal },
    );

    // Dernière liste chargée par le site (pas une réponse resservie, ni une requête remplacée entre-temps).
    net.observe(
      (request) => !request.own && isCollectionList(request),
      (exchange) => {
        if (exchange.synthetic || !exchange.ok || exchange.request !== latestList) return;
        savedFilters.set(toSaved(readCollectionQuery(exchange.request.url)));
      },
      { signal },
    );

    /** Remet les contrôles du site aux filtres retenus, une fois la grille affichée. Vrai si c'est fait. */
    function applyControls(target: CollectionQuery): boolean {
      const filters = findCollectionFilters();
      const field = findCollectionSearchField();
      const sort = filters && findCollectionSelect(filters.sort);
      const tag = filters && findCollectionSelect(filters.tag);
      if (!field || !sort || !tag) return false;
      if (sort.value !== target.sort) sort.onChange(target.sort);
      const tagValue = target.tag === 'untagged' ? UNTAGGED_OPTION : target.tag;
      if (tag.value !== tagValue) tag.onChange(tagValue);
      const rarities = new Set(target.rarities ? target.rarities.split(',') : []);
      for (const pill of findRarityPills()?.pills ?? []) {
        if (pill.checked !== rarities.has(pill.rarity)) pill.button.click();
      }
      if (field.value !== target.search) setReactInputValue(field, target.search);
      return true;
    }

    await whenBody();
    if (signal.aborted) return;
    watchDom(() => {
      if (!restore || restore.phase !== 'controls' || restore.applied || !cached.list) return;
      if (!applyControls(restore.target)) return;
      restore.applied = true;
      timer = window.setTimeout(() => finish('contrôles non remis à temps'), RESTORE_TIMEOUT);
    }, { signal });
  },
};
