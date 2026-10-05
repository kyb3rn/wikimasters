import { jsonSize, tally, type DataItem, type DataSet } from '@/core/data';
import { formatNumber, formatTime, shortDate } from '@/services/market';
import { durationLabel, mergeCardSales, parseCardSales, storedCardSales, type CardSales, type SaleRecord } from './history';
import { clearCardSales, readAllCardSales, readManyCardSales, removeCardSales, writeManyCardSales } from './store';

/** Clé d'une mise en vente dans la fenêtre Mémoire : la carte et la date, qui l'identifie dans son historique. */
const recordKey = (cardId: string, at: number) => `${cardId}@${at}`;

const listingsLabel = (count: number) => `${count} mise${count > 1 ? 's' : ''} en vente`;

function recordFacts(record: SaleRecord): string[] {
  return [`${formatNumber(record.price)} wb`, ...(record.minutes === undefined ? [] : [durationLabel(record.minutes)])];
}

function itemOf(sales: CardSales, bytes: number): DataItem {
  const last = sales.records[0];
  return {
    key: sales.cardId,
    title: sales.title || sales.cardId,
    details: [listingsLabel(sales.records.length), ...(last ? [`Dernière : ${recordFacts(last).join(' · ')}`] : [])],
    ...(last && { date: last.at }),
    count: sales.records.length,
    bytes,
    children: sales.records.map((record) => ({
      key: recordKey(sales.cardId, record.at),
      title: `${shortDate(record.at)} ${formatTime(record.at)}`,
      ...(record.rarity !== undefined && { rarity: record.rarity }),
      shiny: record.shiny,
      details: recordFacts(record),
      date: record.at,
      bytes: jsonSize(storedCardSales({ ...sales, records: [record] }).attempts[0]),
    })),
  };
}

/** Retire des cartes entières (`<carte>`) ou des mises en vente (`<carte>@<date>`). */
async function remove(keys: readonly string[]): Promise<void> {
  const cards: string[] = [];
  const records = new Map<string, Set<number>>();
  for (const key of keys) {
    const at = key.lastIndexOf('@');
    if (at < 0) {
      cards.push(key);
      continue;
    }
    const cardId = key.slice(0, at);
    const dates = records.get(cardId) ?? new Set<number>();
    dates.add(Number(key.slice(at + 1)));
    records.set(cardId, dates);
  }
  if (cards.length > 0) await removeCardSales(cards);
  const touched = await readManyCardSales([...records.keys()].filter((cardId) => !cards.includes(cardId)));
  await writeManyCardSales(
    [...touched.values()].map((sales) => ({ ...sales, records: sales.records.filter((record) => !records.get(sales.cardId)?.has(record.at)) })),
  );
}

/** Historique du fichier (enregistrements du magasin) fusionné avec celui d'ici ; `apply` faux : compté seulement. */
async function mergeFile(raw: unknown, apply: boolean) {
  if (!Array.isArray(raw)) return undefined;
  const incoming = raw.flatMap((value) => {
    const sales = parseCardSales(value);
    return sales && sales.records.length > 0 ? [sales] : [];
  });
  const local = await readManyCardSales(incoming.map((sales) => sales.cardId));
  const merged = incoming.map((sales) => mergeCardSales(local.get(sales.cardId), sales));
  if (apply) await writeManyCardSales(merged.flatMap(({ sales, outcome }) => (outcome === 'unchanged' ? [] : [sales])));
  return tally(
    merged.map(({ outcome }) => outcome),
    raw.length - incoming.length,
  );
}

/** L'historique des mises en vente, dans la fenêtre Mémoire : une ligne par carte, ses mises en vente dessous ; exporté. */
export const listingsData: DataSet = {
  id: 'listings',
  name: 'Historique des mises en vente',
  tab: 'Historique des mises en vente',
  description: 'Chaque mise en vente acceptée par le site, par carte : la fenêtre de mise en vente reprend la dernière.',
  storage: ['idb:wm-market/listings'],
  large: true,
  async list() {
    const { all } = await readAllCardSales();
    return all.map(({ sales, bytes }) => itemOf(sales, bytes));
  },
  remove,
  clear: clearCardSales,
  transfer: {
    async dump() {
      const { all } = await readAllCardSales();
      return all.map(({ sales }) => storedCardSales(sales));
    },
    merge: mergeFile,
  },
};
