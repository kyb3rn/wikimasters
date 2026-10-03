import { isRecord } from '@/core/guards';
import { jsonStore, onStorageChange } from '@/core/storage';
import { serverNow } from '@/site/clock';

/** Carte (modèle) retirée de ma liste de souhaits → heure du retrait (horloge du serveur), du plus ancien au plus récent. */
export type RemovedWishes = Readonly<Record<string, number>>;

/** Mise en vente d'une carte de ma liste, à l'heure de sa notification. */
export interface WishlistListing {
  readonly cardId: string;
  readonly time: number;
}

const MAX_REMOVED = 200;

export function parseRemovedWishes(raw: unknown): RemovedWishes | undefined {
  if (!isRecord(raw)) return undefined;
  return Object.fromEntries(Object.entries(raw).filter((entry): entry is [string, number] => Number.isFinite(entry[1])));
}

/** Une notification arrive tant que la carte est dans la liste : on la suppose dedans, sauf retrait retenu. */
export function wishedIn(removed: RemovedWishes, cardId: string): boolean {
  return removed[cardId] === undefined;
}

/** Retient le retrait, en dernier ; les plus anciens partent au-delà de `max`. */
export function withRemoved(removed: RemovedWishes, cardId: string, at: number, max = MAX_REMOVED): RemovedWishes {
  const entries = Object.entries(removed).filter(([id]) => id !== cardId);
  entries.push([cardId, at]);
  return Object.fromEntries(entries.slice(-max));
}

export function withoutRemoved(removed: RemovedWishes, cardIds: readonly string[]): RemovedWishes {
  return Object.fromEntries(Object.entries(removed).filter(([id]) => !cardIds.includes(id)));
}

/** Cartes retirées revenues dans la liste : notifiées depuis leur retrait. */
export function returnedCards(removed: RemovedWishes, listings: readonly WishlistListing[]): string[] {
  return [...new Set(listings.filter(({ cardId, time }) => (removed[cardId] ?? Infinity) < time).map(({ cardId }) => cardId))];
}

/**
 * Cartes retirées de ma liste de souhaits par le script ou par le site sous nos yeux (modale de carte), partagées
 * entre les onglets du navigateur : la notification de mise en vente ne dit pas si la carte y est encore.
 */
const KEY = 'wm-wishlist-removed-v1';
const store = /* @__PURE__ */ jsonStore<RemovedWishes>(KEY, {}, parseRemovedWishes);

export function removedWishes(): RemovedWishes {
  return store.get();
}

export function rememberWish(cardId: string, wished: boolean): void {
  store.update((removed) => (wished ? withoutRemoved(removed, [cardId]) : withRemoved(removed, cardId, serverNow())));
}

/** Oublie le retrait des cartes de nouveau notifiées. */
export function forgetReturned(listings: readonly WishlistListing[]): void {
  const returned = returnedCards(store.get(), listings);
  if (returned.length > 0) store.update((removed) => withoutRemoved(removed, returned));
}

export function onRemovedWishesElsewhere(listener: () => void, options: { signal: AbortSignal }): void {
  onStorageChange(KEY, listener, options);
}
