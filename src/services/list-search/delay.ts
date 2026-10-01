import { later } from '@/core/async';
import { toggleStyle } from '@/core/dom';
import type { Logger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { restoredQuery, wasLaunched } from './marks';
import { isTypingHeld } from './typing';
import { isSourceRequest, SEARCH_DELAY, type ListQuery, type ListSource } from './types';

export interface ListDelayOptions<Q extends ListQuery> {
  readonly source: ListSource<Q>;
  readonly signal: AbortSignal;
  readonly log: Logger;
  /**
   * `applied` : la page affiche toute réponse, même d'une requête qu'elle a remplacée depuis (une erreur vide
   * sa grille) ; une requête remplacée pendant son attente ne reçoit alors jamais de réponse. Par défaut, elle
   * reçoit une erreur, que la page ignore.
   */
  readonly staleResponses?: 'ignored' | 'applied';
  /** La requête doit partir sans attendre (la page ne peut pas garder ses contrôles affichés pendant l'attente). */
  readonly immediate?: () => boolean;
  /**
   * Indicateur de chargement du site (sélecteur), caché tant qu'une requête attend : la page est déjà « en
   * chargement », la grille reste telle quelle jusqu'au départ de la requête.
   */
  readonly hideWhileWaiting?: string;
}

interface Waiting {
  /** Chargement de la requête : la liste et sa compagne en partagent un. */
  readonly load: number;
  readonly resolve: (response: Response | undefined) => void;
}

/** Attente d'une requête de la liste (ou de sa compagne), d'après la précédente du même genre (aucune : elle part aussitôt). */
export function listWait<Q extends ListQuery>(source: ListSource<Q>, query: Q, previous: Q | undefined): number {
  if (!previous) return 0;
  if (!source.sameChoice(query, previous)) return SEARCH_DELAY;
  // La page a déjà attendu `typingDelay` après la frappe.
  if (source.typingDelay !== undefined && query.search !== previous.search) return Math.max(0, SEARCH_DELAY - source.typingDelay);
  return 0;
}

/**
 * Un changement de choix (tri, raretés…) ne charge la liste qu'après `SEARCH_DELAY` sans autre changement :
 * sa requête (et sa compagne) est retenue avant le réseau, puis envoyée ; celles qu'un chargement plus récent a
 * remplacées n'y vont jamais. Une recherche que la page lance après la frappe (`typingDelay`) attend le reste du
 * délai, et une frappe pendant une attente la repousse ; une recherche lancée à Entrée ou par un bouton, une autre
 * page, une actualisation partent aussitôt.
 * Intercepteur passé en dernier : ce que d'autres fonctionnalités servent sans le réseau n'attend pas.
 */
export function trackListDelay<Q extends ListQuery>(options: ListDelayOptions<Q>): void {
  const { source, signal, log } = options;
  const kept = source.kept?.();
  /** Filtres de la dernière requête de chaque genre ; une liste remise par le site sans requête compte. */
  const previous: { list: Q | undefined; companion: Q | undefined } = { list: kept, companion: kept };
  const planned = new WeakMap<NetRequest, { readonly load: number; readonly wait: number }>();
  /** Un chargement par requête de la liste ; sa compagne part juste avant elle, dans le même chargement. */
  let loads = 0;
  let latest = 0;
  const waiting = new Set<Waiting>();
  let cancelTimer = () => {};
  const isRequest = isSourceRequest(source);
  const superseded =
    options.staleResponses === 'applied'
      ? () => new Promise<Response>(() => undefined)
      : () => Promise.resolve(new Response(null, { status: 499 }));
  const hidden = options.hideWhileWaiting;

  function notify(): void {
    if (hidden && document.documentElement) {
      toggleStyle(`list-wait-${source.id}`, `${hidden} { display: none !important; }`, waiting.size > 0 && !signal.aborted);
    }
  }

  function release(): void {
    cancelTimer();
    const ready = [...waiting];
    waiting.clear();
    if (ready.length > 0) log.debug('changement de filtre envoyé');
    for (const entry of ready) entry.resolve(undefined);
    notify();
  }

  /** Un nouveau chargement rend périmé ce qui attend d'un chargement précédent. */
  function dropBefore(load: number): void {
    for (const entry of waiting) {
      if (entry.load >= load) continue;
      waiting.delete(entry);
      void superseded().then(entry.resolve);
    }
    if (waiting.size === 0) cancelTimer();
    notify();
  }

  signal.addEventListener('abort', release, { once: true });
  if (source.field && source.typingDelay !== undefined) {
    document.addEventListener(
      'input',
      (event) => {
        if (waiting.size === 0 || event.target !== source.field?.()) return;
        cancelTimer();
        cancelTimer = later(release, SEARCH_DELAY, signal);
      },
      { capture: true, signal },
    );
  }

  net.track(
    isRequest,
    (request) => {
      const kind = source.isList(request) ? 'list' : 'companion';
      const query = source.readQuery(request.url);
      if (kind === 'list' && source.appends?.(query)) return undefined;
      const load = kind === 'list' ? ++loads : loads + 1;
      latest = Math.max(latest, load);
      const now = restoredQuery(request) !== undefined || wasLaunched(request) || options.immediate?.() === true;
      planned.set(request, { load, wait: now ? 0 : listWait(source, query, previous[kind]) });
      previous[kind] = query;
      dropBefore(load);
      return undefined;
    },
    { signal },
  );
  net.intercept(
    isRequest,
    (request) => {
      const plan = planned.get(request);
      if (!plan) return undefined;
      if (plan.load < latest) return superseded();
      if (plan.wait === 0) return undefined;
      return new Promise<Response | undefined>((resolve) => {
        waiting.add({ load: plan.load, resolve });
        cancelTimer();
        cancelTimer = later(release, plan.wait, signal);
        notify();
      });
    },
    { signal, last: true },
  );
}

export interface SubmitAfterTypingOptions<Q extends ListQuery> {
  /** Liste de la page et son champ ; sa recherche peut retenir la frappe (`trackListHold`). */
  readonly source: ListSource<Q>;
  readonly signal: AbortSignal;
  /** Bouton du site qui lance la recherche (désactivé quand le champ vaut la recherche en cours). */
  readonly submit: () => HTMLButtonElement | undefined;
}

/**
 * Recherche lancée `SEARCH_DELAY` après la dernière frappe (le site ne la lance qu'à Entrée ou par son
 * bouton, qui restent possibles : Entrée la lance aussitôt), sauf quand la recherche de la page retient la frappe.
 */
export function submitAfterTyping<Q extends ListQuery>({ source, signal, submit }: SubmitAfterTypingOptions<Q>): void {
  let cancelTimer = () => {};
  const isField = (target: EventTarget | null) => target instanceof HTMLInputElement && target === source.field?.();
  document.addEventListener(
    'input',
    (event) => {
      if (!isField(event.target)) return;
      cancelTimer();
      if (isTypingHeld(source)) return;
      cancelTimer = later(
        () => {
          if (isTypingHeld(source)) return;
          const button = submit();
          if (button && !button.disabled) button.click();
        },
        SEARCH_DELAY,
        signal,
      );
    },
    { capture: true, signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter' && isField(event.target)) cancelTimer();
    },
    { capture: true, signal },
  );
}
