import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { siteRequest } from './request';

const FRIENDSHIP = /^\/api\/friends\/([^/]+)$/;

/**
 * Joueur tel que le site le joint à ses réponses (amitiés, recherche de joueurs, messages) :
 * `{ id, username, avatar_url, avatar_pos_x, avatar_pos_y }`, cadrage de la photo en % (50 par défaut).
 */
export interface Player {
  readonly id: string;
  readonly username: string;
  readonly avatarUrl: string | undefined;
  readonly avatarPosX: number;
  readonly avatarPosY: number;
}

const position = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : 50);

export function parsePlayer(raw: unknown): Player | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.username !== 'string') return undefined;
  return {
    id: raw.id,
    username: raw.username,
    avatarUrl: typeof raw.avatar_url === 'string' && raw.avatar_url ? raw.avatar_url : undefined,
    avatarPosX: position(raw.avatar_pos_x),
    avatarPosY: position(raw.avatar_pos_y),
  };
}

/** Amitié telle que le site la reçoit (`requester`, `addressee`, dates… gardés tels quels). */
export interface Friendship {
  readonly id: string;
  /** `pending`, `accepted`. */
  readonly status: string;
  readonly requester_id?: unknown;
  readonly addressee_id?: unknown;
  readonly [field: string]: unknown;
}

export interface FriendsCounts {
  readonly accepted: number;
  readonly incoming: number;
  readonly outgoing: number;
}

/** Réponse de `GET /api/friends` : toutes les amitiés (amis et demandes) et leurs compteurs ; aussi les états de la page Amis. */
export interface FriendsData {
  readonly friendships: readonly Friendship[];
  readonly counts: FriendsCounts;
}

export const isFriendship = (value: unknown): value is Friendship =>
  isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string';

export const isFriendsCounts = (value: unknown): value is FriendsCounts =>
  isRecord(value) && typeof value.accepted === 'number' && typeof value.incoming === 'number' && typeof value.outgoing === 'number';

/** Amitiés lisibles d'une réponse de `GET /api/friends` (aucune si elle est illisible). */
export function parseFriendships(body: unknown): Friendship[] {
  return isRecord(body) && Array.isArray(body.friendships) ? body.friendships.filter(isFriendship) : [];
}

/** Comme `parseFriendships`, mais `undefined` pour une réponse illisible : une liste vide dit qu'il n'y a aucune amitié. */
export function parseFriendsList(body: unknown): Friendship[] | undefined {
  return isRecord(body) && Array.isArray(body.friendships) ? parseFriendships(body) : undefined;
}

/** L'autre joueur d'une amitié de `me` (joint par le site), et son id. */
export function friendOf(friendship: Friendship, me: string): { readonly id: unknown; readonly player: unknown } {
  return friendship.requester_id === me
    ? { id: friendship.addressee_id, player: friendship.addressee }
    : { id: friendship.requester_id, player: friendship.requester };
}

/** Amitiés du joueur, amis et demandes (`GET /api/friends`, comme le site) ; réponse en erreur ou illisible : `SiteApiError`. */
export function fetchFriendships(): Promise<Friendship[]> {
  return siteRequest('/api/friends', {}, parseFriendsList);
}

/**
 * Accepte ou refuse une demande d'ami reçue (id de l'amitié, pas du joueur) : même requête qu'Accepter / Refuser de
 * la page Amis et du profil. Réponse `{ status: "accepted" }` (capture du 30/09/2026).
 */
export async function answerFriendRequest(friendshipId: string, action: 'accept' | 'decline'): Promise<void> {
  await siteRequest(
    `/api/friends/${encodeURIComponent(friendshipId)}`,
    { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ action }) },
    () => true,
  );
}

/**
 * Retire un ami ou annule une demande (id de l'amitié, pas du joueur) : même requête que « Retirer des amis »
 * du profil et « Annuler » de la page Amis. Réponse `{ success }`.
 */
export async function removeFriendship(friendshipId: string): Promise<void> {
  await siteRequest(`/api/friends/${encodeURIComponent(friendshipId)}`, { method: 'DELETE' }, () => true);
}

/** Retrait d'un ami ou annulation d'une demande : `DELETE /api/friends/<id>`. */
export function isFriendshipDelete(request: NetRequest): boolean {
  return request.method === 'DELETE' && FRIENDSHIP.test(request.url.pathname);
}

/**
 * Action de la page Amis sur les amitiés, lue dans sa requête : répondre à une demande reçue, supprimer une
 * amitié (« Annuler » une demande envoyée), « Tout accepter », envoyer une demande (« Ajouter » de la fenêtre
 * « Rechercher un joueur », `POST /api/friends` `{ addressee_id }`).
 */
export type FriendshipAction =
  | { readonly kind: 'accept' | 'decline' | 'delete'; readonly id: string }
  | { readonly kind: 'accept-all' }
  | { readonly kind: 'add'; readonly addresseeId: string };

const jsonBody = (request: NetRequest): unknown => (request.body === undefined ? undefined : parseJson(request.body));

export function readFriendshipAction(request: NetRequest): FriendshipAction | undefined {
  const { method } = request;
  const path = request.url.pathname;
  if (method === 'POST' && path === '/api/friends/accept-all') return { kind: 'accept-all' };
  if (method === 'POST' && path === '/api/friends') {
    const body = jsonBody(request);
    return isRecord(body) && typeof body.addressee_id === 'string' ? { kind: 'add', addresseeId: body.addressee_id } : undefined;
  }
  const id = FRIENDSHIP.exec(path)?.[1];
  if (id === undefined || id === 'accept-all' || id === 'search') return undefined;
  if (method === 'DELETE') return { kind: 'delete', id: decodeURIComponent(id) };
  if (method !== 'PATCH') return undefined;
  const body = jsonBody(request);
  const action = isRecord(body) ? body.action : undefined;
  return action === 'accept' || action === 'decline' ? { kind: action, id: decodeURIComponent(id) } : undefined;
}

/** Recherche de joueurs de la fenêtre « Rechercher un joueur » (`GET /api/friends/search?q=`). */
export function isPlayerSearch(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/friends/search';
}

/** Joueurs trouvés (`{ users: [{ id, username, avatar_url, avatar_pos_x, avatar_pos_y, … }] }`), gardés tels quels. */
export function parsePlayerSearch(body: unknown): (Record<string, unknown> & { readonly id: string })[] {
  const users = isRecord(body) && Array.isArray(body.users) ? body.users : [];
  return users.filter((user): user is Record<string, unknown> & { id: string } => isRecord(user) && typeof user.id === 'string');
}

/** Amitié créée par `POST /api/friends` (201 `{ friendship }`), telle quelle. */
export function parseSentFriendship(body: unknown): Friendship | undefined {
  const friendship = isRecord(body) ? body.friendship : undefined;
  return isFriendship(friendship) ? friendship : undefined;
}

/** Lecture des amis et des demandes (`GET /api/friends`) : page Amis (après chaque action), « Choisir un ami »… */
export function isFriendsList(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/friends';
}

/** Lecture d'un profil par sa page (`GET /api/profile/<pseudo>`). */
export function isProfileRead(request: NetRequest): boolean {
  return request.method === 'GET' && /^\/api\/profile\/[^/]+$/.test(request.url.pathname);
}

/** Amitié avec le joueur d'un profil, d'après `{ profile: { id, isFriend, friendshipId, … } }`. */
export interface ProfileFriendship {
  readonly playerId: string;
  readonly isFriend: boolean;
  /** Amitié ou demande en cours ; absente sans lien. */
  readonly friendshipId: string | undefined;
}

export function parseProfileFriendship(body: unknown): ProfileFriendship | undefined {
  const profile = isRecord(body) ? body.profile : undefined;
  if (!isRecord(profile) || typeof profile.id !== 'string') return undefined;
  return {
    playerId: profile.id,
    isFriend: profile.isFriend === true,
    friendshipId: typeof profile.friendshipId === 'string' && profile.friendshipId ? profile.friendshipId : undefined,
  };
}
