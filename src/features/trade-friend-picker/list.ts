import { normalizeTagName } from '@/site/collection';
import type { PickerFriend } from '@/site/trades';

export type FriendFilter = 'all' | 'free' | 'pending';
export type FriendSort = 'name' | 'recent' | 'old';

export interface FriendChoices {
  readonly query: string;
  readonly filter: FriendFilter;
  readonly sort: FriendSort;
}

export const DEFAULT_CHOICES: FriendChoices = { query: '', filter: 'all', sort: 'name' };

export const FILTER_OPTIONS: readonly { readonly value: FriendFilter; readonly label: string }[] = [
  { value: 'all', label: 'Tous les amis' },
  { value: 'free', label: 'Sans échange en cours' },
  { value: 'pending', label: 'Échange en cours' },
];

export const SORT_OPTIONS: readonly { readonly value: FriendSort; readonly label: string }[] = [
  { value: 'name', label: 'Nom' },
  { value: 'recent', label: 'Amis récents' },
  { value: 'old', label: 'Amis anciens' },
];

const byName = (a: PickerFriend, b: PickerFriend) => a.username.localeCompare(b.username, 'fr', { sensitivity: 'base' });

/**
 * Amis affichés : pseudo contenant la recherche (sans accents ni casse), échange en cours ou non, puis triés par
 * nom ou par date d'amitié (sans date connue : à la fin, par nom).
 */
export function pickFriends(
  friends: readonly PickerFriend[],
  { query, filter, sort }: FriendChoices,
  pending: ReadonlySet<string> | undefined,
  dates: ReadonlyMap<string, number>,
): PickerFriend[] {
  const needle = normalizeTagName(query);
  const shown = friends.filter(
    (friend) =>
      (!needle || normalizeTagName(friend.username).includes(needle)) &&
      (filter === 'all' || !pending || (filter === 'pending') === pending.has(friend.id)),
  );
  if (sort === 'name') return shown.sort(byName);
  const direction = sort === 'recent' ? -1 : 1;
  return shown.sort((a, b) => {
    const [first, second] = [dates.get(a.id), dates.get(b.id)];
    if (first === undefined || second === undefined) return first === second ? byName(a, b) : first === undefined ? 1 : -1;
    return first === second ? byName(a, b) : (first - second) * direction;
  });
}
