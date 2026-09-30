import { watchDom, whenBody } from '@/core/dom';
import type { Logger } from '@/core/log';
import { instantResponse, net, type NetRequest } from '@/core/net';
import type { JsonStore } from '@/core/storage';
import { markRestored } from './restored';
import { sameFilters, type ListQuery, type ListSource } from './types';

/** Filtres retenus : ceux d'une liste, sans sa page (on revient à la première). */
export type Saved<Q extends ListQuery> = Omit<Q, 'page'>;

function withoutPage<Q extends ListQuery>(query: Q): Saved<Q> {
  const { page: _page, ...filters } = query;
  return filters;
}

/** Remise des contrôles : faite, inutile (ils y sont déjà), ou impossible pour l'instant. */
export type ApplyResult = 'applied' | 'unchanged' | 'unavailable';

export interface ListMemoryOptions<Q extends ListQuery> {
  readonly source: ListSource<Q>;
  readonly signal: AbortSignal;
  readonly log: Logger;
  readonly store: JsonStore<Saved<Q> | undefined>;
  /** Adresse de la liste avec d'autres filtres, sa page gardée. */
  withFilters(url: URL, query: Q): URL;
  /** Première liste affichée : les contrôles du site peuvent être remis. */
  ready(): boolean;
  /** Remet les contrôles du site aux filtres retenus. */
  apply(target: Q, signal: AbortSignal): ApplyResult;
  /** Requête par laquelle le site montre qu'il a remis ses filtres lui-même : on n'y touche pas. */
  siteRestore?(request: NetRequest): boolean;
  /** Une réponse a été servie à une requête d'autres filtres que les siens. */
  onMismatch?(): void;
}

/** Délai pour remettre les contrôles du site (recherche comprise), après quoi on lâche. */
const RESTORE_TIMEOUT = 3000;
/**
 * Contrôles remis : les requêtes aux filtres retenus qui suivent encore sont servies elles aussi (plusieurs
 * rendus de la page, un par contrôle remis, peuvent chacun relancer la liste).
 */
const SETTLE_DELAY = 500;

interface Cached {
  readonly body: string;
  readonly contentType: string;
}

/**
 * - `arrival` : rien encore ; la première requête dit si la page part d'autres filtres que ceux retenus ;
 * - `controls` : la première liste part avec les filtres retenus ; une fois affichée, les contrôles du site y
 *   sont remis, chacune de leurs requêtes reçoit la réponse déjà chargée, jusqu'à celle qui les a tous ;
 * - `direct` : première liste affichée sans requête (gardée par le site) : les contrôles sont remis, la page
 *   charge elle-même.
 */
type Phase = 'arrival' | 'controls' | 'direct';

/**
 * Retient les filtres de la dernière liste chargée et y revient à l'arrivée sur la page : la première liste
 * est chargée avec eux (la requête par défaut ne part pas), puis les contrôles du site y sont remis, leurs
 * requêtes servies sans réseau.
 */
export function trackListMemory<Q extends ListQuery>(options: ListMemoryOptions<Q>): void {
  const { source, signal, log, store } = options;
  const saved = store.get();
  let restore: { readonly target: Q; phase: Phase; applied: boolean; settled: boolean } | undefined = saved
    ? { target: { ...saved, page: undefined } as Q, phase: 'arrival', applied: false, settled: false }
    : undefined;
  let cached: Cached | undefined;
  let loaded: Promise<boolean> | undefined;
  const plans = new WeakMap<NetRequest, 'fetch' | 'serve'>();
  let latest: NetRequest | undefined;
  let timer: number | undefined;
  const isRequest = (request: NetRequest) => !request.own && source.isList(request);

  function finish(reason: string): void {
    if (!restore) return;
    log.debug('filtres retenus :', reason);
    restore = undefined;
    clearTimeout(timer);
  }
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });

  net.track(
    (request) => !request.own && (source.isList(request) || options.siteRestore?.(request) === true),
    (request) => {
      if (!source.isList(request)) {
        if (restore?.phase === 'arrival') finish('filtres remis par le site');
        return undefined;
      }
      latest = request;
      if (!restore) return undefined;
      const query = source.readQuery(request.url);
      const reached = sameFilters(source, query, restore.target);
      if (restore.phase === 'arrival') {
        if (reached) {
          finish('la page part déjà de ces filtres');
          return undefined;
        }
        restore.phase = 'controls';
        plans.set(request, 'fetch');
        markRestored(request, restore.target);
        return undefined;
      }
      if (restore.phase === 'direct') {
        markRestored(request, query);
        if (reached) finish('contrôles remis');
        return undefined;
      }
      // Contrôles déjà remis : un autre filtre vient de l'utilisateur, il charge normalement.
      if (restore.settled && !reached) {
        finish('nouveau filtre');
        return undefined;
      }
      markRestored(request, restore.target);
      plans.set(request, 'serve');
      if (reached && !restore.settled) {
        restore.settled = true;
        clearTimeout(timer);
        timer = window.setTimeout(() => finish('contrôles remis'), SETTLE_DELAY);
      }
      return undefined;
    },
    { signal },
  );

  async function fetchRestored(request: NetRequest, target: Q): Promise<Response> {
    const response = await net.fetch(options.withFilters(request.url, target).href);
    if (response.ok) {
      cached = { body: await response.clone().text(), contentType: response.headers.get('content-type') ?? 'application/json' };
    } else {
      finish(`chargement en échec (${response.status})`);
    }
    return response;
  }

  net.intercept(
    isRequest,
    async (request) => {
      const plan = plans.get(request);
      const target = restore?.target;
      if (!plan || !target) return undefined;
      if (!sameFilters(source, source.readQuery(request.url), target)) options.onMismatch?.();
      if (plan === 'fetch') {
        const fetched = fetchRestored(request, target);
        loaded = fetched.then((response) => response.ok, () => false);
        try {
          return await fetched;
        } catch (error) {
          finish('chargement en échec (réseau)');
          throw error;
        }
      }
      if (!(await loaded) || !cached) return undefined;
      return instantResponse(cached.body, { status: 200, headers: { 'content-type': cached.contentType } });
    },
    { signal },
  );

  // Dernière liste chargée par le site (pas une réponse resservie, ni une requête remplacée entre-temps).
  net.observe(
    isRequest,
    (exchange) => {
      if (exchange.synthetic || !exchange.ok || exchange.request !== latest) return;
      store.set(withoutPage(source.readQuery(exchange.request.url)));
    },
    { signal },
  );

  function applyWhenReady(): void {
    if (!restore || restore.applied || !options.ready()) return;
    if (restore.phase === 'controls' && !cached) return;
    if (restore.phase === 'arrival') restore.phase = 'direct';
    const result = options.apply(restore.target, signal);
    if (result === 'unavailable') return;
    if (result === 'unchanged') {
      finish('contrôles déjà remis');
      return;
    }
    restore.applied = true;
    timer = window.setTimeout(() => finish('contrôles non remis à temps'), RESTORE_TIMEOUT);
  }
  void whenBody().then(() => watchDom(applyWhenReady, { signal }));
}
