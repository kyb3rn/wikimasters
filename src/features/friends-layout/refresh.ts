import { isRecord } from '@/core/guards';
import { instantResponse, net, type NetRequest } from '@/core/net';
import type { Logger } from '@/core/log';
import {
  isFriendsList,
  isPlayerSearch,
  parsePlayerSearch,
  parseSentFriendship,
  readFriendshipAction,
  supabaseUserId,
  watchSiteRefusal,
  type FriendsData,
  type FriendshipAction,
} from '@/site/api';
import { applyFriendsChange, findFriendsPage, friendsOwner, readFriendsData, type FriendsChange } from '@/site/friends';

/** Attente au plus de la réponse d'une demande envoyée (lue après coup par un observateur). */
const SENT_TIMEOUT = 5000;
/** Changements rejoués sur l'état de la page : React peut ne pas avoir encore rendu la relecture précédente. */
const REPLAY_MS = 2000;

/**
 * Changement à servir à la relecture qui suit une action : `null` si le site l'a refusée (page servie telle
 * quelle), `undefined` s'il est inconnu (relecture laissée au réseau).
 */
type Served = FriendsChange | null | undefined;

export interface FriendsRefreshOptions {
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** Fin de la requête d'une action du site (`undefined` : échec réseau, le site ne relit alors pas la liste). */
  readonly onActionEnd: (action: FriendshipAction, status: number | undefined) => void;
  /** Refus du site ou pas de réponse (message à montrer) : le site ne les montre pas. */
  readonly onRefused: (message: string) => void;
}

const bySite = (match: (request: NetRequest) => boolean) => (request: NetRequest) => match(request) && !request.own;

/**
 * Après chacune de ses actions sur les amitiés, la page Amis relit tout (`GET /api/friends`, sans regarder la
 * réponse de l'action) : cette relecture reçoit l'état affiché avec le changement confirmé par la réponse de
 * l'action, sans réseau. Chaque action terminée sert la relecture suivante, dans l'ordre des réponses (le site
 * relit dès qu'il a la sienne). Le chargement de la page, lui, va au réseau.
 */
export function serveFriendsRefresh({ signal, log, onActionEnd, onRefused }: FriendsRefreshOptions): void {
  /** Joueurs vus dans « Rechercher un joueur » : la demande envoyée n'a peut-être que l'id du destinataire. */
  const players = new Map<string, Record<string, unknown>>();
  const confirmed: Promise<Served>[] = [];
  /** Réponses attendues des demandes envoyées (`POST /api/friends`), par requête. */
  const sent = new WeakMap<NetRequest, (served: Served) => void>();
  let recent: { readonly change: FriendsChange; readonly at: number }[] = [];

  net.observe(
    bySite(isPlayerSearch),
    async (exchange) => {
      for (const user of parsePlayerSearch(await exchange.json().catch(() => undefined))) players.set(user.id, user);
    },
    { signal },
  );

  const isAction = (request: NetRequest) => readFriendshipAction(request) !== undefined;
  net.track(
    bySite(isAction),
    (request) => {
      const action = readFriendshipAction(request);
      if (!action) return;
      const answer =
        action.kind === 'add'
          ? new Promise<Served>((resolve) => {
              sent.set(request, resolve);
              setTimeout(() => resolve(undefined), SENT_TIMEOUT);
            })
          : undefined;
      return (status) => {
        onActionEnd(action, status);
        if (status === undefined) return;
        if (status >= 400) confirmed.push(Promise.resolve(null));
        else if (answer) confirmed.push(answer);
        else if (action.kind !== 'add') confirmed.push(Promise.resolve(action));
      };
    },
    { signal },
  );

  net.observe(
    bySite(isAction),
    async (exchange) => {
      const resolve = sent.get(exchange.request);
      const action = readFriendshipAction(exchange.request);
      if (!resolve || action?.kind !== 'add') return;
      resolve(exchange.ok ? sentChange(await exchange.json().catch(() => undefined), players.get(action.addresseeId)) : null);
    },
    { signal },
  );
  // Le site ne montre pas ses refus : la demande resterait là, ou « Demande envoyée » serait affiché, sans explication.
  watchSiteRefusal(bySite(isAction), onRefused, { signal });

  net.intercept(
    bySite(isFriendsList),
    async () => {
      const next = confirmed.shift();
      if (!next) return undefined;
      const change = await next;
      const section = findFriendsPage()?.list?.section;
      const data = section && readFriendsData(section);
      if (change === undefined || !data) {
        log.warn('relecture de la page Amis laissée au réseau', change === undefined ? 'changement inconnu' : 'état de la page illisible');
        return undefined;
      }
      const now = Date.now();
      recent = recent.filter((entry) => now - entry.at < REPLAY_MS);
      if (change) recent.push({ change, at: now });
      const owner = supabaseUserId() ?? friendsOwner(data.friendships);
      let served: FriendsData | undefined = data;
      for (const entry of recent) served = served && applyFriendsChange(served, entry.change, owner);
      if (!served) {
        log.warn('relecture de la page Amis laissée au réseau : joueur connecté inconnu');
        return undefined;
      }
      return instantResponse(JSON.stringify(served), { status: 200, headers: { 'Content-Type': 'application/json' } });
    },
    { signal },
  );
}

/** Demande envoyée, avec son destinataire (celui de la réponse, sinon celui de la recherche) pour sa ligne. */
function sentChange(body: unknown, player: Record<string, unknown> | undefined): Served {
  const friendship = parseSentFriendship(body);
  const addressee = isRecord(friendship?.addressee) ? friendship.addressee : player;
  if (!friendship || !addressee) return undefined;
  return { kind: 'add', friendship: { ...friendship, addressee } };
}
