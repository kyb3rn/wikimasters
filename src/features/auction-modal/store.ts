import { idbStore } from '@/core/idb';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { MARKET_DATABASE } from '@/services/market';
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
