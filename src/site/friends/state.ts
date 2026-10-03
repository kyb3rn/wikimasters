import { currentFiberAncestors, findPropsAbove, stateHooks, type StateHook } from '@/core/react';
import { isFriendsCounts, isFriendship, type FriendsCounts, type FriendsData, type Friendship, type FriendshipAction } from '@/site/api';

/**
 * États de la page Amis (code du site du 30/09/2026) : ses amitiés (`GET /api/friends`, `friendships`) et leurs
 * compteurs (`counts`, titres « Amis (n) »…). Chaque ligne d'ami est un composant `{ friendId, username, … }`
 * dont la clé est l'id de l'amitié. Après chacune de ses actions, la page relit tout (`GET /api/friends`) :
 * le script lui sert à la place ces états avec le changement confirmé par l'action (`applyFriendsChange`).
 */
export interface FriendEntry {
  readonly friendshipId: string;
  /** Id du joueur. */
  readonly friendId: string;
  readonly username: string;
}

/**
 * Changement confirmé par le site : l'action de la page (demande reçue acceptée ou refusée, amitié supprimée : ami
 * retiré ou demande envoyée annulée, toutes les demandes reçues acceptées), une demande envoyée avec l'amitié créée.
 */
export type FriendsChange = Exclude<FriendshipAction, { kind: 'add' }> | { readonly kind: 'add'; readonly friendship: Friendship };

const isFriendshipList = (hook: StateHook): hook is StateHook & { value: Friendship[] } =>
  Array.isArray(hook.value) && hook.value.every(isFriendship);

/** États de la page, trouvés en remontant d'un de ses éléments ; les amitiés d'abord, les compteurs à côté. */
function pageStates(element: Element): { list: StateHook & { value: Friendship[] }; counts: StateHook & { value: FriendsCounts } } | undefined {
  for (const fiber of currentFiberAncestors(element)) {
    const states = stateHooks(fiber);
    const counts = states.find((hook): hook is StateHook & { value: FriendsCounts } => isFriendsCounts(hook.value));
    const list = states.find(isFriendshipList);
    if (list && counts) return { list, counts };
  }
  return undefined;
}

/** Amitiés et compteurs affichés par la page (depuis un de ses éléments). */
export function readFriendsData(element: Element): FriendsData | undefined {
  const states = pageStates(element);
  return states && { friendships: states.list.value, counts: states.counts.value };
}

/** Le joueur connecté : le seul présent dans toutes les amitiés (indéterminé avec une seule). */
export function friendsOwner(friendships: readonly Friendship[]): string | undefined {
  let common: unknown[] | undefined;
  for (const { requester_id, addressee_id } of friendships) {
    common = (common ?? [requester_id, addressee_id]).filter((id) => id === requester_id || id === addressee_id);
  }
  const [owner, other] = common ?? [];
  return typeof owner === 'string' && other === undefined ? owner : undefined;
}

const minus = (value: number, count = 1) => Math.max(0, value - count);

/**
 * Applique un changement aux amitiés et aux compteurs, comme les montrerait la relecture du site. Sans effet
 * s'il est déjà appliqué (amitié absente, déjà acceptée…) : un changement peut être rejoué. `owner` (le joueur
 * connecté) n'est utile qu'à « Tout accepter » ; inconnu, ce changement est impossible (`undefined`).
 */
export function applyFriendsChange(data: FriendsData, change: FriendsChange, owner: string | undefined): FriendsData | undefined {
  const { friendships, counts } = data;
  switch (change.kind) {
    case 'accept': {
      const found = friendships.find((friendship) => friendship.id === change.id);
      if (found?.status !== 'pending') return data;
      return {
        friendships: friendships.map((friendship) => (friendship === found ? { ...friendship, status: 'accepted' } : friendship)),
        counts: { ...counts, accepted: counts.accepted + 1, incoming: minus(counts.incoming) },
      };
    }
    case 'decline':
    case 'delete': {
      const found = friendships.find((friendship) => friendship.id === change.id);
      if (!found) return data;
      // Sur cette page, seule une demande envoyée se supprime (« Annuler ») ; un ami retiré est accepté.
      const key = change.kind === 'decline' ? 'incoming' : found.status === 'accepted' ? 'accepted' : 'outgoing';
      return { friendships: friendships.filter((friendship) => friendship !== found), counts: { ...counts, [key]: minus(counts[key]) } };
    }
    case 'accept-all': {
      if (owner === undefined) return undefined;
      const incoming = (friendship: Friendship) => friendship.status === 'pending' && friendship.addressee_id === owner;
      const accepted = friendships.filter(incoming).length;
      if (accepted === 0) return data;
      return {
        friendships: friendships.map((friendship) => (incoming(friendship) ? { ...friendship, status: 'accepted' } : friendship)),
        counts: { ...counts, accepted: counts.accepted + accepted, incoming: minus(counts.incoming, accepted) },
      };
    }
    case 'add': {
      if (friendships.some((friendship) => friendship.id === change.friendship.id)) return data;
      const key = change.friendship.status === 'accepted' ? 'accepted' : 'outgoing';
      return { friendships: [...friendships, change.friendship], counts: { ...counts, [key]: counts[key] + 1 } };
    }
  }
}

/** L'ami d'une ligne de la liste : props et clé de son composant, amitié confirmée par l'état de la page. */
export function readFriendRow(row: Element): FriendEntry | undefined {
  const found = findPropsAbove(row, (props) => typeof props.friendId === 'string' && typeof props.username === 'string');
  if (!found) return undefined;
  const { fiber } = found;
  const friendId = found.props.friendId as string;
  const username = found.props.username as string;
  const friendships = pageStates(row)?.list.value ?? [];
  const friendship =
    friendships.find(({ id }) => id === fiber.key) ??
    friendships.find(({ status, requester_id, addressee_id }) => status === 'accepted' && (requester_id === friendId || addressee_id === friendId));
  const friendshipId = friendship?.id ?? fiber.key ?? undefined;
  return friendshipId ? { friendshipId, friendId, username } : undefined;
}

/**
 * Applique à la page un changement fait hors d'elle (ami retiré par le script, demande acceptée depuis une
 * notification) : la page ne relit ses amitiés qu'après ses propres actions. Faux si ses états sont illisibles.
 */
export function changeFriendsPage(element: Element, change: FriendsChange, owner: string | undefined): boolean {
  const states = pageStates(element);
  if (!states) return false;
  const next = applyFriendsChange({ friendships: states.list.value, counts: states.counts.value }, change, owner);
  if (!next) return false;
  if (next.friendships !== states.list.value) states.list.set(next.friendships);
  if (next.counts !== states.counts.value) states.counts.set(next.counts);
  return true;
}

/** Ôte une amitié de la page (sa ligne, son compteur) ; faux si ses états sont illisibles. */
export function dropFriendship(element: Element, friendshipId: string): boolean {
  if (!pageStates(element)?.list.value.some((friendship) => friendship.id === friendshipId)) return false;
  return changeFriendsPage(element, { kind: 'delete', id: friendshipId }, undefined);
}
