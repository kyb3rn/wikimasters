import { isRecord } from '@/core/guards';
import { jsonStore, onStorageChange } from '@/core/storage';
import type { Friendship, FriendshipAction, ProfileFriendship } from '@/site/api';

/** En attente, acceptée, refusée, ou plus en attente (annulée par le joueur, traitée depuis un autre appareil). */
export type FriendRequestState = 'pending' | 'accepted' | 'declined' | 'gone';

/**
 * Demande d'ami arrivée pendant que le script tournait : seules celles-là reçoivent Accepter / Refuser, celles déjà
 * là au chargement n'en ont pas (demande de l'utilisateur : le script sait ce qu'il en est advenu depuis).
 */
export interface FriendRequest {
  readonly requesterId: string;
  readonly state: FriendRequestState;
  /** Id de l'amitié, une fois lu : la notification ne le donne pas. */
  readonly friendshipId?: string;
  /** Arrivée (horloge du PC, commune aux onglets). */
  readonly at: number;
}

/** Notification (id) → sa demande, des plus anciennes aux plus récentes. */
export type FriendRequests = Readonly<Record<string, FriendRequest>>;

const STATES: readonly unknown[] = ['pending', 'accepted', 'declined', 'gone'] satisfies FriendRequestState[];
const MAX_REQUESTS = 100;

function parseRequest(raw: unknown): FriendRequest | undefined {
  if (!isRecord(raw)) return undefined;
  const { requesterId, state, friendshipId, at } = raw;
  if (typeof requesterId !== 'string' || !STATES.includes(state) || typeof at !== 'number' || !Number.isFinite(at)) return undefined;
  return {
    requesterId,
    state: state as FriendRequestState,
    ...(typeof friendshipId === 'string' && { friendshipId }),
    at,
  };
}

export function parseFriendRequests(raw: unknown): FriendRequests | undefined {
  if (!isRecord(raw)) return undefined;
  return Object.fromEntries(
    Object.entries(raw).flatMap(([id, value]) => {
      const request = parseRequest(value);
      return request ? [[id, request] as const] : [];
    }),
  );
}

/** Retient une demande arrivée, en attente, sans toucher à celle déjà retenue (un autre onglet a pu y répondre). */
export function withArrival(requests: FriendRequests, notificationId: string, requesterId: string, at: number, max = MAX_REQUESTS): FriendRequests {
  if (requests[notificationId]) return requests;
  const arrived: FriendRequest = { requesterId, state: 'pending', at };
  return Object.fromEntries([...Object.entries(requests), [notificationId, arrived] as const].slice(-max));
}

/** Change les demandes en attente ; mêmes demandes (`===`) si rien ne change, pour ne rien écrire. */
function updatePending(requests: FriendRequests, change: (request: FriendRequest) => FriendRequest): FriendRequests {
  let changed = false;
  const next = Object.fromEntries(
    Object.entries(requests).map(([id, request]) => {
      if (request.state !== 'pending') return [id, request];
      const updated = change(request);
      changed ||= updated !== request;
      return [id, updated];
    }),
  );
  return changed ? next : requests;
}

/** Réponse donnée à toutes les demandes en attente du joueur : une seule amitié pour toutes ses notifications. */
export function withAnswer(requests: FriendRequests, requesterId: string, state: FriendRequestState): FriendRequests {
  return updatePending(requests, (request) => (request.requesterId === requesterId ? { ...request, state } : request));
}

/**
 * Demandes en attente confrontées aux amitiés (`GET /api/friends`) : id de l'amitié encore en attente, sinon
 * acceptée (amis) ou plus en attente. Une demande arrivée après le départ de la lecture (`since`) n'y est peut-être pas.
 */
export function withFriendships(requests: FriendRequests, friendships: readonly Friendship[], since: number): FriendRequests {
  return updatePending(requests, (request) => {
    const { requesterId } = request;
    const pending = friendships.find((friendship) => friendship.status === 'pending' && friendship.requester_id === requesterId);
    if (pending) return pending.id === request.friendshipId ? request : { ...request, friendshipId: pending.id };
    if (request.at > since) return request;
    const friends = friendships.some(
      (friendship) => friendship.status === 'accepted' && (friendship.requester_id === requesterId || friendship.addressee_id === requesterId),
    );
    return { ...request, state: friends ? 'accepted' : 'gone' };
  });
}

/** Profil du joueur lu par sa page (`GET /api/profile/<pseudo>`) : l'id de l'amitié, ou déjà amis. */
export function withProfile(requests: FriendRequests, profile: ProfileFriendship): FriendRequests {
  return updatePending(requests, (request) => {
    if (request.requesterId !== profile.playerId) return request;
    if (profile.isFriend) return { ...request, state: 'accepted' };
    const { friendshipId } = profile;
    return friendshipId === undefined || friendshipId === request.friendshipId ? request : { ...request, friendshipId };
  });
}

/** Réponse donnée par le site (page Amis, profil) : reconnue à l'id de l'amitié, ou « Tout accepter ». */
export function withSiteAction(requests: FriendRequests, action: FriendshipAction): FriendRequests {
  switch (action.kind) {
    case 'accept-all':
      return updatePending(requests, (request) => ({ ...request, state: 'accepted' }));
    case 'accept':
    case 'decline':
    case 'delete': {
      const state = action.kind === 'accept' ? 'accepted' : action.kind === 'decline' ? 'declined' : 'gone';
      return updatePending(requests, (request) => (request.friendshipId === action.id ? { ...request, state } : request));
    }
    case 'add':
      return requests;
  }
}

const KEY = 'wm-friend-requests-v1';

/** Partagées entre les onglets : une demande arrive dans chacun, la réponse donnée dans l'un vaut pour tous. */
const store = /* @__PURE__ */ jsonStore<FriendRequests>(KEY, {}, parseFriendRequests);

export function friendRequests(): FriendRequests {
  return store.get();
}

export function updateFriendRequests(change: (requests: FriendRequests) => FriendRequests): void {
  const current = store.get();
  const next = change(current);
  if (next !== current) store.set(next);
}

export function onFriendRequestsElsewhere(listener: () => void, options: { signal: AbortSignal }): void {
  onStorageChange(KEY, listener, options);
}
