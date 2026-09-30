import { h } from 'preact';
import { childController } from '@/core/async';
import { watchDom, whenBody } from '@/core/dom';
import { instantResponse, net, type NetRequest } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { restoredQuery } from '@/services/collection-restore';
import {
  COLLECTION_ROUTE,
  findCollectionFilters,
  findCollectionPagination,
  findCollectionRefresh,
  isCollectionList,
  isCollectionStats,
  readCollectionQuery,
  type CollectionQuery,
} from '@/site/collection';
import { lockControl, unlockAll } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { SearchButton } from './SearchButton';
import { isListChange, searchStatus } from './state';

const OWNER = 'collection-search';

type Kind = 'list' | 'stats';

interface Cached {
  readonly body: string;
  readonly contentType: string;
}

/** Réponse d'une requête passée : arrivée plus tard par l'observateur, aucune si elle a échoué. */
interface Loaded {
  readonly request: NetRequest;
  response?: Cached;
}

const isCollectionRequest = (request: NetRequest) => !request.own && (isCollectionList(request) || isCollectionStats(request));

/**
 * Un changement d'étiquette, de tri ou de raretés n'est pas envoyé au site : sa requête (liste et compteurs)
 * reçoit la réponse déjà affichée, la page garde sa grille et ses filtres montrent le nouveau choix. Notre
 * bouton appelle l'actualisation de la page, qui charge avec les choix tels qu'ils sont (sa roue sur la
 * grille pendant le chargement). Tant qu'une recherche attend, la pagination est verrouillée : elle
 * chargerait une autre page des nouveaux filtres sans leurs compteurs (le site ne les demande qu'en page 1).
 */
export const collectionSearch: Feature = {
  id: 'collection-search',
  name: 'Recherche',
  toggleLabel: 'Empêcher le rechargement automatique',
  description:
    "Changer d'étiquette, de tri ou de raretés ne relance pas la recherche : un bouton la lance, puis recharge la liste.",
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  async mount(ctx) {
    const { signal, log } = ctx;
    /** Dernière requête de la page, par genre : ce que disent ses filtres. */
    const requested: Partial<Record<Kind, CollectionQuery>> = {};
    let shown: (Loaded & { readonly query: CollectionQuery }) | undefined;
    let stats: Loaded | undefined;
    /** Requêtes retenues et la réponse (déjà affichée) qui leur est servie. */
    const held = new WeakMap<NetRequest, Cached>();
    /** Liste demandée au site, pas encore reçue. */
    let loading: NetRequest | undefined;
    let placed: { ui: MountedUi; controller: AbortController } | undefined;

    net.track(
      isCollectionRequest,
      (request) => {
        const kind: Kind = isCollectionList(request) ? 'list' : 'stats';
        // Retour aux filtres retenus (collection-memory) : la page affiche ceux-là, quelle que soit l'adresse.
        const restored = restoredQuery(request);
        const query = restored ?? readCollectionQuery(request.url);
        const previous = requested[kind];
        requested[kind] = query;
        // Liste en cours de chargement : le choix part avec (resservir l'ancienne grille la contredirait).
        const reply = !restored && !loading && shown?.response && (kind === 'list' ? shown.response : stats?.response);
        if (reply && isListChange(query, previous) && findCollectionRefresh()) {
          held.set(request, reply);
          sync();
          return undefined;
        }
        if (kind === 'stats') {
          stats = { request };
          return undefined;
        }
        loading = request;
        sync();
        return () => {
          if (loading !== request) return;
          loading = undefined;
          shown = { request, query };
          sync();
        };
      },
      { signal },
    );
    net.intercept(
      isCollectionRequest,
      (request) => {
        const reply = held.get(request);
        if (!reply) return undefined;
        log.debug('changement de liste retenu', request.url.pathname + request.url.search);
        // Lue sans délai : la roue du site n'a pas le temps d'apparaître.
        return instantResponse(reply.body, { status: 200, headers: { 'content-type': reply.contentType } });
      },
      { signal },
    );
    net.observe(
      isCollectionRequest,
      async (exchange) => {
        const target = [shown, stats].find((loaded) => loaded?.request === exchange.request);
        if (!target || !exchange.ok) return;
        const body = await exchange.text();
        target.response = { body, contentType: exchange.headers.get('content-type') ?? 'application/json' };
      },
      { signal },
    );

    function run(): void {
      if (loading) return;
      const refresh = findCollectionRefresh();
      if (!refresh) {
        log.warn('actualisation de la page introuvable');
        toast.error("La recherche n'a pas pu être lancée. Rechargez la page.", { title: 'Recherche' });
        return;
      }
      // Mêmes listes que la requête retenue : ce n'est plus un changement, elle part.
      try {
        Promise.resolve(refresh()).catch((error: unknown) => log.debug('actualisation du site en échec', error));
      } catch (error) {
        log.error('actualisation du site en échec', error);
      }
    }

    /** Bouton au bout de la rangée des listes, pagination verrouillée tant qu'une recherche attend. Idempotent. */
    function sync(): void {
      if (signal.aborted || !document.body) return;
      const status = searchStatus({ loading: loading !== undefined, requested: requested.list, shown: shown?.query });
      const filters = findCollectionFilters();
      if (!filters) {
        placed?.controller.abort();
        placed = undefined;
      } else {
        const vnode = h(SearchButton, { status, onClick: run });
        if (placed?.ui.element.parentElement === filters.row && placed.ui.element.nextSibling === null) {
          placed.ui.update(vnode);
        } else {
          placed?.controller.abort();
          const controller = childController(signal);
          placed = { ui: mountUi(vnode, { parent: filters.row, inline: true, signal: controller.signal }), controller };
        }
      }
      for (const button of findCollectionPagination()) {
        lockControl(button, { owner: OWNER, locked: status === 'search', reason: "Lancez d'abord la recherche" });
      }
    }

    await whenBody();
    if (signal.aborted) return;
    watchDom(sync, { signal });
    sync();
    ctx.onDispose(() => unlockAll(OWNER));
  },
};
