import { isRecord } from '@/core/guards';
import type { SortOrder } from '@/ui/controls';

/** Par pseudo, par date de l'amitié. */
export type FriendSort = 'name' | 'date';

export interface FriendsSort {
  readonly sort: FriendSort;
  readonly order: SortOrder;
}

export const FRIEND_SORT_OPTIONS: readonly { readonly value: FriendSort; readonly label: string }[] = [
  { value: 'name', label: 'Nom' },
  { value: 'date', label: "Date d'amitié" },
];

/** Sens de chaque tri quand on le choisit : de A à Z, les amis les plus récents d'abord. */
export const FRIEND_SORT_ORDER: Readonly<Record<FriendSort, SortOrder>> = { name: 'asc', date: 'desc' };

/** Ce que dit chaque sens de chaque tri (info-bulle du bouton du sens). */
export const FRIEND_ORDER_LABELS: Readonly<Record<FriendSort, Readonly<Record<SortOrder, string>>>> = {
  name: { asc: 'De A à Z', desc: 'De Z à A' },
  date: { desc: 'Des plus récents aux plus anciens', asc: 'Des plus anciens aux plus récents' },
};

export const DEFAULT_FRIENDS_SORT: FriendsSort = { sort: 'name', order: FRIEND_SORT_ORDER.name };

export function parseFriendsSort(raw: unknown): FriendsSort | undefined {
  if (!isRecord(raw)) return undefined;
  const sort = FRIEND_SORT_OPTIONS.find((option) => option.value === raw.sort)?.value;
  if (!sort) return undefined;
  return { sort, order: raw.order === 'asc' || raw.order === 'desc' ? raw.order : FRIEND_SORT_ORDER[sort] };
}

const byName = (a: { readonly username: string }, b: { readonly username: string }) =>
  a.username.localeCompare(b.username, 'fr', { sensitivity: 'base' });

/**
 * Amis dans l'ordre du tri, sans toucher à la liste reçue ; `timeOf` : date de l'amitié (ms). Par date, ceux sans
 * date connue à la fin, par nom (de même pour deux dates égales).
 */
export function sortFriends<F extends { readonly username: string }>(
  friends: readonly F[],
  { sort, order }: FriendsSort,
  timeOf: (friend: F) => number | undefined,
): F[] {
  const sign = order === 'asc' ? 1 : -1;
  if (sort === 'name') return [...friends].sort((a, b) => sign * byName(a, b));
  return friends
    .map((friend) => ({ friend, time: timeOf(friend) }))
    .sort((a, b) => {
      if (a.time === undefined || b.time === undefined) return a.time === b.time ? byName(a.friend, b.friend) : a.time === undefined ? 1 : -1;
      return a.time === b.time ? byName(a.friend, b.friend) : sign * (a.time - b.time);
    })
    .map(({ friend }) => friend);
}
