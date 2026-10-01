import type { Logger } from '@/core/log';
import { cacheResponse, net, replayResponse, type CachedResponse, type NetRequest } from '@/core/net';
import { markLaunched, restoredQuery } from './marks';
import { holdTyping } from './typing';
import { isSourceRequest, type ListQuery, type ListSource, type SearchStatus } from './types';

export interface ListHoldOptions<Q extends ListQuery> {
  readonly source: ListSource<Q>;
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** La page sait-elle recharger sa liste à la demande ? Sinon un changement n'est pas retenu : rien ne le lancerait. */
  readonly canReload: () => boolean;
  /** Choix affichés par les contrôles de la page, s'ils se lisent (sinon ceux de la dernière requête). */
  readonly currentChoice?: () => Q | undefined;
  /**
   * `replay` (défaut) : une requête retenue reçoit la dernière réponse chargée. `none` : elle ne reçoit jamais
   * de réponse, la page garde sa liste telle quelle (pages ajoutées comprises) ; seulement pour une page qui
   * n'attend pas cette réponse pour se servir de ses contrôles.
   */
  readonly heldReply?: 'replay' | 'none';
  /** Changement de l'état de la recherche (bouton à redessiner, verrous). */
  readonly onChange: () => void;
  /** Requête de la liste retenue : elle reçoit la liste affichée. */
  readonly onHeld?: (request: NetRequest) => void;
  /** Liste chargée par le site : elle est désormais celle affichée. */
  readonly onShown?: (query: Q) => void;
}

export interface ListHold {
  status(): SearchStatus;
  /** Le champ ne vaut plus la recherche affichée : c'est elle qu'il faut lancer. */
  searchTyped(): boolean;
  /** La prochaine requête de la liste est lancée par l'utilisateur (notre bouton) : une recherche part. */
  launch(): void;
  /** Un lancement attend encore sa requête de la liste. */
  launchPending(): boolean;
}

/** Réglage qui active la recherche retenue : mêmes textes sur toutes les pages. */
export const HOLD_SETTING = {
  toggleLabel: 'Empêcher le rechargement automatique',
  description: 'Changer un filtre ou taper une recherche ne recharge pas la liste : la recherche part avec Entrée ou son bouton.',
} as const;

/** Durée pendant laquelle un lancement (Entrée, notre bouton) vaut pour la requête de la liste qui suit. */
const LAUNCH_WINDOW = 1000;

/** Liste vue par la page : sa requête (aucune si le site l'a remise de lui-même), ses filtres, sa réponse. */
interface Shown<Q> {
  readonly request?: NetRequest;
  readonly query: Q;
  response?: CachedResponse;
}

/**
 * Un changement de choix (tri, raretés…) ou de recherche n'est pas envoyé au site : la requête de la liste (et
 * celle de sa compagne) reçoit la réponse déjà affichée, la page garde sa grille et ses contrôles montrent le
 * nouveau choix ; la page recharge ensuite à la demande (bouton de la recherche). Une autre page, une
 * actualisation, une recherche lancée (Entrée, `launch()`) chargent comme d'habitude, avec les choix tels qu'ils
 * sont. Une recherche que le site lance de lui-même (après la frappe, ou sa croix qui vide le champ) est retenue
 * comme un changement de choix.
 */
export function trackListHold<Q extends ListQuery>(options: ListHoldOptions<Q>): ListHold {
  const { source, signal, log } = options;
  const kept = source.kept?.();
  /** Dernière requête de la page, de la liste et de sa compagne : ce que disent ses filtres. */
  let requested: Q | undefined = kept;
  let requestedCompanion: Q | undefined = kept;
  let shown: Shown<Q> | undefined = kept && { query: kept };
  /** Dernière compagne partie au site : sa réponse va avec la liste affichée. */
  let companion: { readonly request: NetRequest; response?: CachedResponse } | undefined;
  const held = new WeakMap<NetRequest, CachedResponse | 'none'>();
  /** Liste demandée au site, pas encore reçue. */
  let loading: NetRequest | undefined;
  /** Moment du dernier lancement d'une recherche par l'utilisateur. */
  let launchedAt = -Infinity;
  const isRequest = isSourceRequest(source);
  /** La page a un champ de recherche : la frappe est retenue elle aussi. */
  const typed = source.field !== undefined;
  const field = () => source.field?.();
  if (typed) {
    holdTyping(source, signal);
    document.addEventListener('input', () => options.onChange(), { capture: true, signal });
    document.addEventListener(
      'keydown',
      (event) => {
        if (event.key === 'Enter' && event.target === field()) launchedAt = performance.now();
      },
      { capture: true, signal },
    );
  }

  net.track(
    isRequest,
    (request) => {
      const isCompanion = !source.isList(request);
      // Retour aux filtres retenus : la page affiche ceux-là, quelle que soit l'adresse.
      const restored = restoredQuery<Q>(request);
      const query = restored ?? source.readQuery(request.url);
      const previous = isCompanion ? requestedCompanion : requested;
      if (isCompanion) requestedCompanion = query;
      else requested = query;
      if (!isCompanion && source.appends?.(query)) return undefined;
      const launched = performance.now() - launchedAt < LAUNCH_WINDOW;
      // La compagne part juste avant la liste : le lancement vaut pour les deux.
      if (!isCompanion) launchedAt = -Infinity;
      // Liste en cours de chargement : le choix part avec (resservir l'ancienne grille la contredirait).
      const response = shown?.response && (isCompanion ? companion?.response : shown.response);
      const reply = !restored && !loading && shown && (options.heldReply === 'none' ? 'none' : response);
      const searched = previous !== undefined && query.search !== previous.search;
      const chosen = previous !== undefined && !source.sameChoice(query, previous);
      const change = typed && !launched ? searched || chosen : chosen && !searched;
      if (reply && change && options.canReload()) {
        held.set(request, reply);
        if (!isCompanion) options.onHeld?.(request);
        options.onChange();
        return undefined;
      }
      if (launched) markLaunched(request);
      if (isCompanion) {
        companion = { request };
        return undefined;
      }
      loading = request;
      options.onChange();
      return () => {
        if (loading !== request) return;
        loading = undefined;
        shown = { request, query };
        options.onShown?.(query);
        options.onChange();
      };
    },
    { signal },
  );
  net.intercept(
    isRequest,
    (request) => {
      const reply = held.get(request);
      if (!reply) return undefined;
      log.debug('changement retenu', request.url.pathname + request.url.search);
      if (reply === 'none') return new Promise<Response>(() => undefined);
      // Lue sans délai : l'état « chargement » de la page n'a pas le temps d'être dessiné.
      return replayResponse(reply);
    },
    { signal },
  );
  net.observe(
    isRequest,
    async (exchange) => {
      const target = [shown, companion].find((loaded) => loaded?.request === exchange.request);
      if (!target || !exchange.ok) return;
      target.response = await cacheResponse(exchange);
    },
    { signal },
  );

  function searchTyped(): boolean {
    const text = field()?.value;
    return text !== undefined && shown !== undefined && text.trim() !== shown.query.search;
  }

  return {
    status() {
      if (loading) return 'loading';
      const current = options.currentChoice?.() ?? requested;
      return searchTyped() || (current && shown && !source.sameChoice(current, shown.query)) ? 'search' : 'reload';
    },
    searchTyped,
    launch() {
      launchedAt = performance.now();
    },
    launchPending: () => performance.now() - launchedAt < LAUNCH_WINDOW,
  };
}
