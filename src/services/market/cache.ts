import { jsonSize, type MergeOutcome } from '@/core/data';
import { isRecord } from '@/core/guards';
import { idbStore, type IdbDatabase } from '@/core/idb';
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
 * Base de l'ancien script (bibliothèque marché) : un utilisateur qui l'avait retrouve son cache et ses mises en
 * vente. Magasins : `sales` (ventes, ici) et `listings` (mises en vente, historique de la mise aux enchères). La
 * version 3 crée `listings` chez qui n'avait pas l'ancien script (sa version 2 l'avait déjà).
 */
export const MARKET_DATABASE: IdbDatabase = { name: 'wm-market', version: 3, stores: ['sales', 'listings'] };

/** Identifiant de l'historique du marché dans la Mémoire (fichier d'export, changements entre onglets). */
export const MARKET_HISTORY_DATA = 'market-history';

/** Enregistrement : `{ id, fetchedAt, title, sales: [{ id, final_price, settled_at, rarity }] }` (ventes au format du site). */
const store = idbStore({ database: MARKET_DATABASE, store: 'sales' });

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

/** Ventes en cache de plusieurs cartes, en une lecture ; absentes du cache : pas dans le résultat. */
export async function readEntries(cardIds: readonly string[]): Promise<Map<string, MarketEntry>> {
  const unique = [...new Set(cardIds)];
  const values = await store.getMany(unique);
  const entries = new Map<string, MarketEntry>();
  values.forEach((value, index) => {
    const entry = parseStoredEntry(value);
    const cardId = unique[index];
    if (entry && entry.cardId === cardId) entries.set(cardId, entry);
  });
  return entries;
}

export function writeEntry(entry: MarketEntry): Promise<void> {
  return store.put(storedEntry(entry));
}

export function writeEntries(entries: readonly MarketEntry[]): Promise<void> {
  return store.putMany(entries.map(storedEntry));
}

/** Tout le cache, avec la taille de chaque enregistrement ; illisibles : `invalid`. */
export async function readAllEntries(): Promise<{ readonly entries: readonly { readonly entry: MarketEntry; readonly bytes: number }[]; readonly invalid: number }> {
  const values = await store.values();
  const entries = values.flatMap((value) => {
    const entry = parseStoredEntry(value);
    return entry ? [{ entry, bytes: jsonSize(value) }] : [];
  });
  return { entries, invalid: values.length - entries.length };
}

export function deleteEntries(cardIds: readonly string[]): Promise<void> {
  return store.deleteMany(cardIds);
}

/**
 * Ventes d'une carte venues d'un autre navigateur, fusionnées avec celles d'ici : une vente ne change jamais, toutes
 * celles des deux côtés sont gardées (par leur id), à la date du chargement le plus récent, sous son titre.
 */
export function mergeEntry(local: MarketEntry | undefined, incoming: MarketEntry): { readonly entry: MarketEntry; readonly outcome: MergeOutcome } {
  if (!local) return { entry: incoming, outcome: 'added' };
  const sales = new Map(local.sales.map((sale) => [sale.id, sale]));
  let added = false;
  for (const sale of incoming.sales) {
    if (sales.has(sale.id)) continue;
    sales.set(sale.id, sale);
    added = true;
  }
  const newer = incoming.fetchedAt > local.fetchedAt;
  const entry: MarketEntry = {
    cardId: local.cardId,
    title: (newer ? incoming.title || local.title : local.title || incoming.title),
    fetchedAt: Math.max(local.fetchedAt, incoming.fetchedAt),
    sales: added ? [...sales.values()].sort((a, b) => a.time - b.time) : local.sales,
  };
  const changed = added || entry.fetchedAt !== local.fetchedAt || entry.title !== local.title;
  return { entry, outcome: changed ? 'updated' : 'unchanged' };
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
