import { isRecord } from '@/core/guards';
import { currentFiberAncestors, stateHooks, type StateHook } from '@/core/react';

/**
 * États de la page Amis (code du site du 30/09/2026) : ses amitiés (`GET /api/friends`, `friendships`) et leurs
 * compteurs (`counts`, titre « Amis (n) »). Chaque ligne d'ami est un composant `{ friendId, username, … }`
 * dont la clé est l'id de l'amitié. La page ne sait retirer qu'une demande envoyée (« Annuler ») : un ami
 * retiré par le script en est ôté ici, comme le ferait sa relecture.
 */
export interface FriendEntry {
  readonly friendshipId: string;
  /** Id du joueur. */
  readonly friendId: string;
  readonly username: string;
}

interface Friendship {
  readonly id: string;
  readonly status: string;
  readonly requester_id?: unknown;
  readonly addressee_id?: unknown;
}

interface Counts {
  readonly accepted: number;
  readonly incoming: number;
  readonly outgoing: number;
}

const isFriendship = (value: unknown): value is Friendship =>
  isRecord(value) && typeof value.id === 'string' && typeof value.status === 'string';

const isCounts = (value: unknown): value is Counts =>
  isRecord(value) && typeof value.accepted === 'number' && typeof value.incoming === 'number' && typeof value.outgoing === 'number';

const isFriendshipList = (hook: StateHook): hook is StateHook & { value: Friendship[] } =>
  Array.isArray(hook.value) && hook.value.every(isFriendship);

/** États de la page, trouvés en remontant d'un de ses éléments ; les amitiés d'abord, les compteurs à côté. */
function pageStates(element: Element): { list: StateHook & { value: Friendship[] }; counts: StateHook | undefined } | undefined {
  for (const fiber of currentFiberAncestors(element)) {
    const states = stateHooks(fiber);
    const counts = states.find((hook) => isCounts(hook.value));
    const list = states.find(isFriendshipList);
    if (list && counts) return { list, counts };
  }
  return undefined;
}

/** L'ami d'une ligne de la liste : props et clé de son composant, amitié confirmée par l'état de la page. */
export function readFriendRow(row: Element): FriendEntry | undefined {
  for (const fiber of currentFiberAncestors(row)) {
    const props = fiber.memoizedProps;
    if (!isRecord(props) || typeof props.friendId !== 'string' || typeof props.username !== 'string') continue;
    const { friendId, username } = props;
    const friendships = pageStates(row)?.list.value ?? [];
    const found =
      friendships.find((friendship) => friendship.id === fiber.key) ??
      friendships.find(
        (friendship) =>
          friendship.status === 'accepted' && (friendship.requester_id === friendId || friendship.addressee_id === friendId),
      );
    const friendshipId = found?.id ?? fiber.key ?? undefined;
    return friendshipId ? { friendshipId, friendId, username } : undefined;
  }
  return undefined;
}

/** Ôte une amitié de la page (sa ligne, le compte « Amis (n) ») ; faux si ses états sont illisibles. */
export function dropFriendship(element: Element, friendshipId: string): boolean {
  const states = pageStates(element);
  if (!states) return false;
  const { list, counts } = states;
  if (!list.value.some((friendship) => friendship.id === friendshipId)) return false;
  list.set(list.value.filter((friendship) => friendship.id !== friendshipId));
  if (counts && isCounts(counts.value)) counts.set({ ...counts.value, accepted: Math.max(0, counts.value.accepted - 1) });
  return true;
}
