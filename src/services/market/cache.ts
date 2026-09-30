import { isRecord } from '@/core/guards';
import { idbStore } from '@/core/idb';
import { parseSale, type Sale } from '@/site/api';

/** Ventes d'une carte telles que chargées depuis le site, à une date donnée. */
export interface MarketEntry {
  readonly cardId: string;
  readonly title: string;
  /** Date du chargement (ms). */
  readonly fetchedAt: number;
  /** Du plus ancien au plus récent. */
  readonly sales: readonly Sale[];
}

/**
 * Base et forme de l'ancien script (bibliothèque marché) : un utilisateur qui l'avait retrouve son cache.
 * Enregistrement : `{ id, fetchedAt, title, sales: [{ id, final_price, settled_at, rarity }] }` (ventes au
 * format du site). La version 2 de la base a aussi le magasin `listings` de l'ancien script, inutilisé ici.
 */
const store = idbStore({ database: 'wm-market', version: 2, store: 'sales' });

export function parseStoredEntry(raw: unknown): MarketEntry | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.fetchedAt !== 'number' || !Array.isArray(raw.sales)) {
    return undefined;
  }
  return {
    cardId: raw.id,
    title: typeof raw.title === 'string' ? raw.title : '',
    fetchedAt: raw.fetchedAt,
    sales: raw.sales.flatMap((sale) => parseSale(sale) ?? []).sort((a, b) => a.time - b.time),
  };
}

export function storedEntry(entry: MarketEntry) {
  return {
    id: entry.cardId,
    fetchedAt: entry.fetchedAt,
    title: entry.title,
    sales: entry.sales.map((sale) => ({
      id: sale.id,
      final_price: sale.price,
      settled_at: new Date(sale.time).toISOString(),
      rarity: sale.rarity,
    })),
  };
}

export async function readEntry(cardId: string): Promise<MarketEntry | undefined> {
  return parseStoredEntry(await store.get(cardId));
}

export function writeEntry(entry: MarketEntry): Promise<void> {
  return store.put(storedEntry(entry));
}

/** Cartes en cache et taille approximative (octets du JSON de chaque enregistrement). */
export async function cacheInfo(): Promise<{ readonly cards: number; readonly bytes: number }> {
  const values = await store.values();
  const encoder = new TextEncoder();
  return { cards: values.length, bytes: values.reduce((sum: number, value) => sum + encoder.encode(JSON.stringify(value)).length, 0) };
}

export function clearCache(): Promise<void> {
  return store.clear();
}
