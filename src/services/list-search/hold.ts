import { instantResponse, net, type NetRequest } from '@/core/net';
import type { Logger } from '@/core/log';
import { restoredQuery } from './restored';
import type { ListQuery, ListSource, SearchStatus } from './types';

interface Cached {
  readonly body: string;
  readonly contentType: string;
}

export interface ListHoldOptions<Q extends ListQuery> {
  readonly source: ListSource<Q>;
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** La page sait-elle recharger sa liste à la demande ? Sinon un changement n'est pas retenu : rien ne le lancerait. */
  readonly canReload: () => boolean;
  /** Page qui s'ajoute à la liste affichée (« Charger la suite ») au lieu de la remplacer. */
  readonly appends?: (query: Q) => boolean;
  /** Choix affichés par les contrôles de la page, s'ils se lisent (sinon ceux de la dernière requête). */
  readonly currentChoice?: () => Q | undefined;
  /** Changement de l'état de la recherche (bouton à redessiner, verrous). */
  readonly onChange: () => void;
  /** Requête retenue : elle reçoit la liste affichée. */
  readonly onHeld?: (request: NetRequest) => void;
  /** Liste chargée par le site : elle est désormais celle affichée. */
  readonly onShown?: (query: Q) => void;
}

export interface ListHold {
  status(): SearchStatus;
}

/**
 * Un changement de choix (tri, raretés…) n'est pas envoyé au site : la requête de la liste reçoit la réponse
 * déjà affichée, la page garde sa grille et ses contrôles montrent le nouveau choix ; la page recharge ensuite
 * à la demande (bouton de la recherche). Une recherche, une autre page, une actualisation chargent comme
 * d'habitude, avec les choix tels qu'ils sont.
 */
export function trackListHold<Q extends ListQuery>(options: ListHoldOptions<Q>): ListHold {
  const { source, signal, log } = options;
  /** Dernière requête de la page : ce que disent ses filtres. */
  let requested: Q | undefined;
  let shown: { readonly request: NetRequest; readonly query: Q; response?: Cached } | undefined;
  const held = new WeakMap<NetRequest, Cached>();
  /** Liste demandée au site, pas encore reçue. */
  let loading: NetRequest | undefined;
  const isRequest = (request: NetRequest) => !request.own && source.isList(request);

  net.track(
    isRequest,
    (request) => {
      // Retour aux filtres retenus : la page affiche ceux-là, quelle que soit l'adresse.
      const restored = restoredQuery<Q>(request);
      const query = restored ?? source.readQuery(request.url);
      const previous = requested;
      requested = query;
      if (options.appends?.(query)) return undefined;
      // Liste en cours de chargement : le choix part avec (resservir l'ancienne grille la contredirait).
      const reply = !restored && !loading && shown?.response;
      const change = previous !== undefined && !source.sameChoice(query, previous) && query.search === previous.search;
      if (reply && change && options.canReload()) {
        held.set(request, reply);
        options.onHeld?.(request);
        options.onChange();
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
      log.debug('changement de choix retenu', request.url.pathname + request.url.search);
      // Lue sans délai : l'état « chargement » de la page n'a pas le temps d'être dessiné.
      return instantResponse(reply.body, { status: 200, headers: { 'content-type': reply.contentType } });
    },
    { signal },
  );
  net.observe(
    isRequest,
    async (exchange) => {
      const target = shown;
      if (target?.request !== exchange.request || !exchange.ok) return;
      target.response = { body: await exchange.text(), contentType: exchange.headers.get('content-type') ?? 'application/json' };
    },
    { signal },
  );

  return {
    status() {
      if (loading) return 'loading';
      const current = options.currentChoice?.() ?? requested;
      return current && shown && !source.sameChoice(current, shown.query) ? 'search' : 'reload';
    },
  };
}
