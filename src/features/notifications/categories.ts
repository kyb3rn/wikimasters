import { jsonStore } from '@/core/storage';
import type { LocalType } from '@/services/notifications';
import type { IconName } from '@/ui/icons';

/** Filtres de la liste (demande de l'utilisateur) : ce qui n'entre dans aucun, type inconnu compris, va dans « Autres ». */
export type NotificationCategory = 'messages' | 'bids' | 'listings' | 'sales' | 'wishlist' | 'friends' | 'trades' | 'other';

export interface CategoryOption {
  readonly value: NotificationCategory;
  readonly label: string;
  readonly icon: IconName;
}

/** Dans l'ordre des cases ; icônes de leurs lignes. */
export const CATEGORIES: readonly CategoryOption[] = [
  { value: 'messages', label: 'Messages', icon: 'message' },
  { value: 'bids', label: 'Enchères gagnées et surenchères', icon: 'trophy' },
  { value: 'listings', label: 'Mises en vente', icon: 'gavel' },
  { value: 'sales', label: 'Cartes vendues', icon: 'coins' },
  { value: 'wishlist', label: 'Liste de souhaits', icon: 'bookmark' },
  { value: 'friends', label: "Demandes d'ami", icon: 'user' },
  { value: 'trades', label: 'Échanges', icon: 'handshake' },
  { value: 'other', label: 'Autres', icon: 'bell' },
];

/**
 * Choix de l'utilisateur : « Mises en vente » suit mes enchères jusqu'à leur fin, sauf la vente ; batailles, guilde
 * et modération restent dans « Autres ».
 */
const SITE_CATEGORIES: Readonly<Record<string, NotificationCategory>> = {
  chat_message: 'messages',
  marketplace_outbid: 'bids',
  marketplace_auction_won: 'bids',
  marketplace_auction_midpoint_nudge: 'listings',
  marketplace_auction_unsold: 'listings',
  marketplace_auction_sold: 'sales',
  marketplace_wishlist_listed: 'wishlist',
  friend_request: 'friends',
  trade_offer: 'trades',
  trade_accepted: 'trades',
  trade_declined: 'trades',
  trade_countered: 'trades',
};

const LOCAL_CATEGORIES: Readonly<Record<LocalType, NotificationCategory>> = {
  'auction-published': 'listings',
};

export function siteCategory(type: string): NotificationCategory {
  return SITE_CATEGORIES[type] ?? 'other';
}

export function localCategory(type: LocalType | undefined): NotificationCategory {
  return type === undefined ? 'other' : LOCAL_CATEGORIES[type];
}

const CATEGORY_VALUES = new Set<unknown>(CATEGORIES.map(({ value }) => value));

export function parseFilter(raw: unknown): NotificationCategory[] | undefined {
  return Array.isArray(raw) ? raw.filter((value): value is NotificationCategory => CATEGORY_VALUES.has(value)) : undefined;
}

/** Cases cochées, gardées d'une ouverture et d'une page à l'autre. */
const filterMemory = jsonStore<readonly NotificationCategory[]>('wm-notifications-filter-v1', [], parseFilter);

export function savedFilter(): ReadonlySet<NotificationCategory> {
  return new Set(filterMemory.get());
}

export function saveFilter(filter: ReadonlySet<NotificationCategory>): void {
  filterMemory.set(CATEGORIES.flatMap(({ value }) => (filter.has(value) ? [value] : [])));
}

/** Rien de coché : tout. */
export function filtered<T extends { readonly category: NotificationCategory }>(entries: readonly T[], filter: ReadonlySet<NotificationCategory>): readonly T[] {
  return filter.size === 0 ? entries : entries.filter((entry) => filter.has(entry.category));
}

/** Non lues de chaque catégorie, pour la pastille de sa case. */
export function unreadByCategory(entries: readonly { readonly category: NotificationCategory; readonly read: boolean }[]): ReadonlyMap<NotificationCategory, number> {
  const counts = new Map<NotificationCategory, number>();
  for (const { category, read } of entries) if (!read) counts.set(category, (counts.get(category) ?? 0) + 1);
  return counts;
}
