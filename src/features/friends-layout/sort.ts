import { jsonStore } from '@/core/storage';
import { DEFAULT_FRIENDS_SORT, FRIEND_ORDER_LABELS, FRIEND_SORT_OPTIONS, parseFriendsSort, type FriendsSort } from '@/services/friends';

export const FRIENDS_SORT_KEY = 'wm-friends-sort-v1';
/** Dernier tri choisi, remis à l'arrivée sur la page. */
export const savedSort = jsonStore(FRIENDS_SORT_KEY, DEFAULT_FRIENDS_SORT, parseFriendsSort);

/** Faits de la fenêtre Mémoire : le tri, puis son sens. */
export function sortDetails({ sort, order }: FriendsSort): string[] {
  const label = FRIEND_SORT_OPTIONS.find((option) => option.value === sort)?.label ?? sort;
  return [`Tri : ${label}`, FRIEND_ORDER_LABELS[sort][order]];
}
