import { DEFAULT_FRIENDS_SORT, sortFriends, type FriendsSort } from '@/services/friends';
import type { Player } from '@/site/api';
import { normalizeTagName } from '@/site/collection';

/** Tous les amis, ceux sans la marque, ceux avec. */
export type FriendFilter = 'all' | 'without' | 'with';

export interface FriendChoices {
  readonly query: string;
  readonly filter: FriendFilter;
  readonly sort: FriendsSort;
}

export const DEFAULT_CHOICES: FriendChoices = { query: '', filter: 'all', sort: DEFAULT_FRIENDS_SORT };

export const FRIEND_FILTERS: readonly FriendFilter[] = ['all', 'without', 'with'];

/**
 * Amis affichés : pseudo contenant la recherche (sans accents ni casse), marqués ou non (`marked` : échange en cours ;
 * inconnu, pas de filtre), puis triés par nom ou par date d'amitié (`dates`, par id de l'ami), dans un sens ou dans
 * l'autre.
 */
export function pickFriends<F extends Player>(
  friends: readonly F[],
  { query, filter, sort }: FriendChoices,
  marked: ReadonlySet<string> | undefined,
  dates: ReadonlyMap<string, number>,
): F[] {
  const needle = normalizeTagName(query);
  const shown = friends.filter(
    (friend) =>
      (!needle || normalizeTagName(friend.username).includes(needle)) &&
      (filter === 'all' || !marked || (filter === 'with') === marked.has(friend.id)),
  );
  return sortFriends(shown, sort, (friend) => dates.get(friend.id));
}
