import { idbStore } from '@/core/idb';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { MARKET_DATABASE } from '@/services/market';
import { jsonSize } from '@/core/data';
import { parseCardSales, storedCardSales, withoutRecord, withRecord, type CardSales, type SaleRecord } from './history';

/** Magasin de l'ancien script (wm-vente) : un utilisateur qui l'avait retrouve ses mises en vente. */
const store = idbStore({ database: MARKET_DATABASE, store: 'listings' });
const log = createLogger('mises en vente');
const changes = createListeners<[CardSales]>(log);

const empty = (cardId: string, title: string): CardSales => ({ cardId, title, records: [] });

export async function readCardSales(cardId: string): Promise<CardSales | undefined> {
  return parseCardSales(await store.get(cardId));
}

async function update(cardId: string, title: string, change: (sales: CardSales) => CardSales): Promise<void> {
  const current = (await readCardSales(cardId)) ?? empty(cardId, title);
  const next = change({ ...current, title: title || current.title });
  if (next.records.length === 0) await store.delete(cardId);
  else await store.put(storedCardSales(next));
  changes.emit(next);
}

export function addSaleRecord(card: { readonly id: string; readonly title: string }, record: SaleRecord): Promise<void> {
  return update(card.id, card.title, (sales) => withRecord(sales, record));
}

export function removeSaleRecord(cardId: string, at: number): Promise<void> {
  return update(cardId, '', (sales) => withoutRecord(sales, at));
}

/** Mises en vente d'une carte changées dans cet onglet (nouvelle, retirée de l'historique). */
export function onCardSalesChange(listener: (sales: CardSales) => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}

/** Tout l'historique, avec la taille de chaque carte ; illisibles : `invalid`. */
export async function readAllCardSales(): Promise<{ readonly all: readonly { readonly sales: CardSales; readonly bytes: number }[]; readonly invalid: number }> {
  const values = await store.values();
  const all = values.flatMap((value) => {
    const sales = parseCardSales(value);
    return sales ? [{ sales, bytes: jsonSize(value) }] : [];
  });
  return { all, invalid: values.length - all.length };
}

/** Plusieurs cartes d'un coup (absentes : pas dans le résultat). */
export async function readManyCardSales(cardIds: readonly string[]): Promise<Map<string, CardSales>> {
  const values = await store.getMany(cardIds);
  const found = new Map<string, CardSales>();
  for (const value of values) {
    const sales = parseCardSales(value);
    if (sales) found.set(sales.cardId, sales);
  }
  return found;
}

/** Remplace l'historique de ces cartes (import) ; une carte sans mise en vente est retirée. */
export async function writeManyCardSales(list: readonly CardSales[]): Promise<void> {
  await store.putMany(list.filter((sales) => sales.records.length > 0).map(storedCardSales));
  await store.deleteMany(list.filter((sales) => sales.records.length === 0).map((sales) => sales.cardId));
  for (const sales of list) changes.emit(sales);
}

/** Retire tout l'historique de ces cartes. */
export async function removeCardSales(cardIds: readonly string[]): Promise<void> {
  await store.deleteMany(cardIds);
  for (const cardId of cardIds) changes.emit(empty(cardId, ''));
}

export async function clearCardSales(): Promise<void> {
  await store.clear();
}
