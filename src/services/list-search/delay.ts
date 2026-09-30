import type { Logger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { restoredQuery } from './restored';
import { SEARCH_DELAY, type ListQuery, type ListSource } from './types';

export interface ListDelayOptions<Q extends ListQuery> {
  readonly source: ListSource<Q>;
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** Page qui s'ajoute à la liste affichée (« Charger la suite ») : elle part aussitôt et ne remplace rien. */
  readonly appends?: (query: Q) => boolean;
  /**
   * La page lance elle-même sa recherche `delay` après la dernière frappe dans `field` : un changement de
   * recherche n'attend que le reste de `SEARCH_DELAY`, et une frappe pendant une attente la repousse. Sans
   * elle, une recherche part aussitôt (déjà attendue).
   */
  readonly typing?: { readonly delay: number; readonly field: () => HTMLInputElement | undefined };
  /**
   * `applied` : la page affiche toute réponse, même d'une requête qu'elle a remplacée depuis (une erreur vide
   * sa grille) ; une requête remplacée pendant son attente ne reçoit alors jamais de réponse. Par défaut, elle
   * reçoit une erreur, que la page ignore.
   */
  readonly staleResponses?: 'ignored' | 'applied';
  /** La requête doit partir sans attendre (la page ne peut pas garder ses contrôles affichés pendant l'attente). */
  readonly immediate?: () => boolean;
  /** Une requête attend, ou plus aucune. */
  readonly onWaiting?: (waiting: boolean) => void;
}

interface Waiting {
  readonly load: number;
  readonly resolve: (response: Response | undefined) => void;
}

/** Attente d'une requête de la liste, d'après la précédente (aucune : elle part aussitôt). */
export function listWait<Q extends ListQuery>(
  source: ListSource<Q>,
  query: Q,
  previous: Q | undefined,
  typingDelay: number | undefined,
): number {
  if (!previous) return 0;
  if (!source.sameChoice(query, previous)) return SEARCH_DELAY;
  if (typingDelay !== undefined && query.search !== previous.search) return Math.max(0, SEARCH_DELAY - typingDelay);
  return 0;
}

/**
 * Un changement de choix (tri, raretés…) ne charge la liste qu'après `SEARCH_DELAY` sans autre changement :
 * sa requête est retenue avant le réseau, puis envoyée ; celles qu'une plus récente a remplacées n'y vont
 * jamais. Une recherche (déjà attendue pendant la frappe, sauf `typing`), une autre page, une
 * actualisation partent aussitôt.
 * Intercepteur passé en dernier : ce que d'autres fonctionnalités servent sans le réseau n'attend pas.
 */
export function trackListDelay<Q extends ListQuery>(options: ListDelayOptions<Q>): void {
  const { source, signal, log, appends } = options;
  let previous: Q | undefined;
  const planned = new WeakMap<NetRequest, { readonly load: number; readonly wait: number }>();
  let loads = 0;
  const waiting = new Set<Waiting>();
  let timer: number | undefined;
  const isRequest = (request: NetRequest) => !request.own && source.isList(request);
  const superseded =
    options.staleResponses === 'applied'
      ? () => new Promise<Response>(() => undefined)
      : () => Promise.resolve(new Response(null, { status: 499 }));

  function notify(): void {
    options.onWaiting?.(waiting.size > 0);
  }

  function release(): void {
    clearTimeout(timer);
    timer = undefined;
    const ready = [...waiting];
    waiting.clear();
    if (ready.length > 0) log.debug('changement de filtre envoyé');
    for (const entry of ready) entry.resolve(undefined);
    notify();
  }
  signal.addEventListener('abort', release, { once: true });
  const typing = options.typing;
  if (typing) {
    document.addEventListener(
      'input',
      (event) => {
        if (waiting.size === 0 || event.target !== typing.field()) return;
        clearTimeout(timer);
        timer = window.setTimeout(release, SEARCH_DELAY);
      },
      { capture: true, signal },
    );
  }

  net.track(
    isRequest,
    (request) => {
      const query = source.readQuery(request.url);
      if (appends?.(query)) return undefined;
      const load = ++loads;
      // Retour aux filtres retenus : aucune attente, la page le fait d'elle-même.
      const wait =
        restoredQuery(request) !== undefined || options.immediate?.() ? 0 : listWait(source, query, previous, options.typing?.delay);
      planned.set(request, { load, wait });
      previous = query;
      for (const entry of waiting) {
        waiting.delete(entry);
        void superseded().then(entry.resolve);
      }
      if (waiting.size === 0) clearTimeout(timer);
      notify();
      return undefined;
    },
    { signal },
  );
  net.intercept(
    isRequest,
    (request) => {
      const plan = planned.get(request);
      if (!plan) return undefined;
      if (plan.load < loads) return superseded();
      if (plan.wait === 0) return undefined;
      return new Promise<Response | undefined>((resolve) => {
        waiting.add({ load: plan.load, resolve });
        clearTimeout(timer);
        timer = window.setTimeout(release, plan.wait);
        notify();
      });
    },
    { signal, last: true },
  );
}

export interface TypingOptions {
  readonly signal: AbortSignal;
  /** Champ de recherche de la page. */
  readonly field: () => HTMLInputElement | undefined;
  /** Bouton du site qui lance la recherche (désactivé quand le champ vaut la recherche en cours). */
  readonly submit: () => HTMLButtonElement | undefined;
}

/**
 * Recherche lancée `SEARCH_DELAY` après la dernière frappe (le site ne la lance qu'à Entrée ou par son
 * bouton, qui restent possibles : Entrée la lance aussitôt).
 */
export function submitAfterTyping({ signal, field, submit }: TypingOptions): void {
  let timer: number | undefined;
  signal.addEventListener('abort', () => clearTimeout(timer), { once: true });
  const isField = (target: EventTarget | null) => target instanceof HTMLInputElement && target === field();
  document.addEventListener(
    'input',
    (event) => {
      if (!isField(event.target)) return;
      clearTimeout(timer);
      timer = window.setTimeout(() => {
        const button = submit();
        if (button && !button.disabled) button.click();
      }, SEARCH_DELAY);
    },
    { capture: true, signal },
  );
  document.addEventListener(
    'keydown',
    (event) => {
      if (event.key === 'Enter' && isField(event.target)) clearTimeout(timer);
    },
    { capture: true, signal },
  );
}
