import { later, waitUntil } from '@/core/async';
import { watchDom, whenBody } from '@/core/dom';
import { isRecord } from '@/core/guards';
import type { Logger } from '@/core/log';
import { cacheResponse, net, replayResponse, type CachedResponse, type NetRequest } from '@/core/net';
import { setReactInputValue } from '@/core/react';
import { jsonStore, type JsonStore } from '@/core/storage';
import { splitRarities } from '@/site/list-query';
import type { RarityPills } from '@/site/rarity-pills';
import { markRestored } from './marks';
import { isSourceRequest, sameFilters, type ListQuery, type ListSource } from './types';

/** Filtres retenus : ceux d'une liste, sans sa page (on revient à la première). */
export type Saved<Q extends ListQuery> = Omit<Q, 'page'>;

function withoutPage<Q extends ListQuery>(query: Q): Saved<Q> {
  const { page: _page, ...filters } = query;
  return filters;
}

/** Forme d'un filtre retenu : `text`, une chaîne non vide (le tri). */
type SavedKind = 'string' | 'text' | 'boolean';

/** Forme des filtres retenus d'une liste, filtre par filtre. */
export type SavedShape<Q extends ListQuery> = { readonly [K in keyof Saved<Q>]-?: Saved<Q>[K] extends boolean ? 'boolean' : 'string' | 'text' };

/** Filtres retenus relus du stockage ; rien si leur forme n'est pas celle attendue. */
export function parseSavedFilters<Q extends ListQuery>(raw: unknown, shape: SavedShape<Q>): Saved<Q> | undefined {
  if (!isRecord(raw)) return undefined;
  const saved: Record<string, unknown> = {};
  for (const [key, kind] of Object.entries(shape) as [string, SavedKind][]) {
    const value = raw[key];
    const valid = kind === 'boolean' ? typeof value === 'boolean' : typeof value === 'string' && (kind === 'string' || value !== '');
    if (!valid) return undefined;
    saved[key] = value;
  }
  return saved as Saved<Q>;
}

/** Stockage des filtres retenus d'une liste (`wm-<page>-filters-v<n>`). */
export function savedFiltersStore<Q extends ListQuery>(key: string, shape: SavedShape<Q>): JsonStore<Saved<Q> | undefined> {
  return jsonStore<Saved<Q> | undefined>(key, undefined, (raw) => parseSavedFilters(raw, shape));
}

/** Remise des contrôles : faite, inutile (ils y sont déjà), ou impossible pour l'instant. */
export type ApplyResult = 'applied' | 'unchanged' | 'unavailable';

/** Coche exactement ces raretés (`rarities` d'une requête) dans les pastilles du site, par leurs clics. Vrai si une a changé. */
export function applyRarities(pills: RarityPills, rarities: string): boolean {
  const wanted = new Set(splitRarities(rarities));
  let changed = false;
  for (const pill of pills.pills) {
    if (pill.checked === wanted.has(pill.rarity)) continue;
    pill.button.click();
    changed = true;
  }
  return changed;
}

/** Délai pour que le bouton du site qui lance la recherche prenne le texte remis dans le champ. */
const SUBMIT_TIMEOUT = 2000;

/**
 * Remet la recherche dans le champ du site ; `submit` : son bouton qui la lance (page qui ne cherche qu'à Entrée
 * ou par lui), cliqué dès qu'il s'active. Vrai si le champ a changé.
 */
export function applySearch(field: HTMLInputElement, text: string, submit: (() => HTMLButtonElement | undefined) | undefined, signal: AbortSignal): boolean {
  if (field.value.trim() === text) return false;
  setReactInputValue(field, text);
  if (submit) {
    void waitUntil(() => submit()?.disabled === false, { signal, timeoutMs: SUBMIT_TIMEOUT }).then((ready) => {
      if (ready) submit()?.click();
    });
  }
  return true;
}

export interface ListMemoryOptions<Q extends ListQuery> {
  readonly source: ListSource<Q>;
  readonly signal: AbortSignal;
  readonly log: Logger;
  readonly store: JsonStore<Saved<Q> | undefined>;
  /** Adresse de la liste (ou de sa compagne) avec d'autres filtres, sa page gardée. */
  withFilters(url: URL, query: Q): URL;
  /** Première liste affichée : les contrôles du site peuvent être remis. */
  ready(): boolean;
  /** Remet les contrôles du site aux filtres retenus. */
  apply(target: Q, signal: AbortSignal): ApplyResult;
  /**
   * La page peut afficher sa première liste sans la demander (gardée par le site) : ses contrôles sont alors
   * remis, elle charge d'elle-même. Vrai par défaut.
   */
  readonly direct?: boolean;
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

/**
 * - `arrival` : rien encore ; la première requête dit si la page part d'autres filtres que ceux retenus ;
 * - `controls` : la première liste part avec les filtres retenus ; une fois affichée, les contrôles du site y
 *   sont remis, chacune de leurs requêtes reçoit la réponse déjà chargée, jusqu'à celle qui les a tous ;
 * - `direct` : première liste affichée sans requête (gardée par le site) : les contrôles sont remis, la page
 *   charge elle-même.
 */
type Phase = 'arrival' | 'controls' | 'direct';

/**
 * Retient les filtres de la dernière liste chargée et y revient à l'arrivée sur la page : la première liste (et
 * sa compagne) est chargée avec eux (la requête par défaut ne part pas), puis les contrôles du site y sont remis,
 * leurs requêtes servies sans réseau.
 */
export function trackListMemory<Q extends ListQuery>(options: ListMemoryOptions<Q>): void {
  const { source, signal, log, store } = options;
  const saved = store.get();
  let restore: { readonly target: Q; phase: Phase; applied: boolean; settled: boolean } | undefined = saved
    ? { target: { ...saved, page: undefined } as Q, phase: 'arrival', applied: false, settled: false }
    : undefined;
  /** Réponses chargées avec les filtres retenus. */
  let cached: CachedResponse | undefined;
  let cachedCompanion: CachedResponse | undefined;
  /** Chargement de la liste avec les filtres retenus : les requêtes suivantes l'attendent. */
  let loaded: Promise<boolean> | undefined;
  const plans = new WeakMap<NetRequest, 'fetch' | 'serve'>();
  let latest: NetRequest | undefined;
  let cancelTimer = () => {};
  const isRequest = isSourceRequest(source);

  function finish(reason: string): void {
    if (!restore) return;
    log.debug('filtres retenus :', reason);
    restore = undefined;
    cancelTimer();
  }

  net.track(
    (request) => isRequest(request) || (!request.own && options.siteRestore?.(request) === true),
    (request) => {
      if (!isRequest(request)) {
        if (restore?.phase === 'arrival') finish('filtres remis par le site');
        return undefined;
      }
      const isList = source.isList(request);
      if (isList) latest = request;
      if (!restore) return undefined;
      const query = source.readQuery(request.url);
      const reached = sameFilters(source, query, restore.target);
      if (restore.phase === 'arrival') {
        if (reached) {
          finish('la page part déjà de ces filtres');
          return undefined;
        }
        // La compagne part juste avant la liste : elle aussi, avec les filtres retenus.
        if (isList) restore.phase = 'controls';
        plans.set(request, 'fetch');
        markRestored(request, restore.target);
        return undefined;
      }
      if (restore.phase === 'direct') {
        markRestored(request, query);
        if (reached && isList) finish('contrôles remis');
        return undefined;
      }
      // Contrôles déjà remis : un autre filtre vient de l'utilisateur, il charge normalement.
      if (restore.settled && !reached) {
        finish('nouveau filtre');
        return undefined;
      }
      markRestored(request, restore.target);
      plans.set(request, 'serve');
      if (isList && reached && !restore.settled) {
        restore.settled = true;
        cancelTimer();
        cancelTimer = later(() => finish('contrôles remis'), SETTLE_DELAY, signal);
      }
      return undefined;
    },
    { signal },
  );

  async function fetchRestored(request: NetRequest, target: Q): Promise<Response> {
    const response = await net.fetch(options.withFilters(request.url, target).href);
    const isList = source.isList(request);
    if (response.ok) {
      const body = await cacheResponse(response);
      if (isList) cached = body;
      else cachedCompanion = body;
    } else if (isList) {
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
      const isList = source.isList(request);
      if (!sameFilters(source, source.readQuery(request.url), target)) options.onMismatch?.();
      if (plan === 'fetch') {
        const fetched = fetchRestored(request, target);
        if (isList) loaded = fetched.then((response) => response.ok, () => false);
        try {
          return await fetched;
        } catch (error) {
          if (isList) finish('chargement en échec (réseau)');
          throw error;
        }
      }
      if (!(await loaded)) return undefined;
      const reply = isList ? cached : cachedCompanion;
      return reply && replayResponse(reply);
    },
    { signal },
  );

  // Dernière liste chargée par le site (pas une réponse resservie, ni une requête remplacée entre-temps).
  net.observe(
    (request) => !request.own && source.isList(request),
    (exchange) => {
      if (exchange.synthetic || !exchange.ok || exchange.request !== latest) return;
      store.set(withoutPage(source.readQuery(exchange.request.url)));
    },
    { signal },
  );

  function applyWhenReady(): void {
    if (!restore || restore.applied || !options.ready()) return;
    if (restore.phase === 'controls' && !cached) return;
    if (restore.phase === 'arrival') {
      if (options.direct === false) return;
      restore.phase = 'direct';
    }
    const result = options.apply(restore.target, signal);
    if (result === 'unavailable') return;
    if (result === 'unchanged') {
      finish('contrôles déjà remis');
      return;
    }
    restore.applied = true;
    cancelTimer = later(() => finish('contrôles non remis à temps'), RESTORE_TIMEOUT, signal);
  }
  void whenBody(signal).then((body) => {
    if (body) watchDom(applyWhenReady, { signal });
  });
}
