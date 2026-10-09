import { announceDataChange, tally, type DataItem, type DataSet } from '@/core/data';
import { siteErrorText } from '@/site/api';
import { parseRarity, RARITIES } from '@/site/rarity';
import { toast } from '@/ui/toast';
import {
  clearCache,
  deleteEntries,
  MARKET_HISTORY_DATA,
  mergeEntry,
  parseStoredEntry,
  readAllEntries,
  readEntries,
  readEntry,
  storedEntry,
  writeEntries,
  type MarketEntry,
} from './cache';
import { plural } from './format';
import { fetchMarket, isStale, marketNeedsPro } from './market';
import { showMarketModal, showProOffer } from './open';
import { median } from './stats';

/** Prix des ventes par rareté (code du site, `?` : inconnue). */
function pricesByRarity(entry: MarketEntry): Map<string, number[]> {
  const groups = new Map<string, number[]>();
  for (const sale of entry.sales) {
    const rarity = parseRarity(sale.rarity) ?? '?';
    const prices = groups.get(rarity);
    if (prices) prices.push(sale.price);
    else groups.set(rarity, [sale.price]);
  }
  return groups;
}

function itemOf(entry: MarketEntry, bytes: number): DataItem {
  const groups = pricesByRarity(entry);
  // « L 2 · UR 9 · R 22 » : ventes par rareté, de la plus haute à la plus basse.
  const counts = RARITIES.flatMap((rarity) => {
    const prices = groups.get(rarity);
    return prices ? [`${rarity} ${prices.length}`] : [];
  });
  return {
    key: entry.cardId,
    title: entry.title || entry.cardId,
    details: [plural(entry.sales.length, 'vente'), ...(counts.length > 0 ? [counts.join(' · ')] : [])],
    date: entry.fetchedAt,
    stale: isStale(entry),
    count: entry.sales.length,
    medians: Object.fromEntries([...groups].map(([rarity, prices]) => [rarity, median(prices) ?? 0])),
    ...(entry.sales.length > 0 && { lastSale: Math.max(...entry.sales.map((sale) => sale.time)) }),
    bytes,
  };
}

/** Ventes du fichier (enregistrements du magasin) fusionnées avec le cache ; `apply` faux : comptées seulement. */
async function mergeFile(raw: unknown, apply: boolean) {
  if (!Array.isArray(raw)) return undefined;
  const incoming = raw.flatMap((value) => parseStoredEntry(value) ?? []);
  const local = await readEntries(incoming.map((entry) => entry.cardId));
  const merged = incoming.map((entry) => mergeEntry(local.get(entry.cardId), entry));
  if (apply) {
    const changed = merged.flatMap(({ entry, outcome }) => (outcome === 'unchanged' ? [] : [entry]));
    if (changed.length > 0) {
      await writeEntries(changed);
      announceDataChange(MARKET_HISTORY_DATA);
    }
  }
  return tally(
    merged.map(({ outcome }) => outcome),
    raw.length - incoming.length,
  );
}

/** Le cache des ventes, dans la fenêtre Mémoire : une ligne par carte, exporté. */
export const marketHistoryData: DataSet = {
  id: MARKET_HISTORY_DATA,
  name: 'Historique du marché',
  tab: 'Historique du marché',
  description: "Ventes de chaque carte chargées depuis le site : elles donnent les prix moyens et l'historique.",
  storage: ['idb:wm-market/sales'],
  large: true,
  salesFilters: true,
  async list() {
    const { entries } = await readAllEntries();
    return entries.map(({ entry, bytes }) => itemOf(entry, bytes));
  },
  async remove(keys) {
    await deleteEntries(keys);
    announceDataChange(MARKET_HISTORY_DATA);
  },
  async clear() {
    await clearCache();
    announceDataChange(MARKET_HISTORY_DATA);
  },
  open(key) {
    void readEntry(key).then((entry) => {
      if (entry) showMarketModal({ id: entry.cardId, title: entry.title, rarity: undefined }, entry);
    });
  },
  // Comme « Actualiser » de l'historique : sans PRO, l'offre du site.
  async refresh(key) {
    const card = { id: key, title: (await readEntry(key))?.title ?? '', rarity: undefined };
    if (marketNeedsPro()) {
      showProOffer(card);
      return;
    }
    await fetchMarket(card).catch((error: unknown) => toast.error(siteErrorText(error), { title: 'Ventes non actualisées' }));
  },
  transfer: {
    async dump() {
      const { entries } = await readAllEntries();
      return entries.map(({ entry }) => storedEntry(entry));
    },
    merge: mergeFile,
  },
};
