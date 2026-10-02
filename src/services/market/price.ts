import type { Rarity } from '@/site/rarity';
import type { MarketEntry } from './cache';
import { lastMean } from './stats';

/** Ventes moyennées pour le prix d'une carte : les plus récentes. */
export const PRICE_SALES = 7;

/** Prix moyen d'une carte dans une rareté. */
export interface MarketPrice {
  /** Moyenne des 7 dernières ventes (ou de ce qu'il y a), arrondie au-dessus. */
  readonly average: number;
  /** Ventes de la rareté, toutes (pas seulement les 7). */
  readonly count: number;
}

const prices = new WeakMap<MarketEntry, Map<string, MarketPrice | undefined>>();

/**
 * Prix moyen d'une carte : ventes de sa rareté, toutes raretés seulement si elle est inconnue. Aucune vente dans
 * cette rareté (une carte dégradée, souvent), même s'il y en a dans d'autres : `undefined`.
 */
export function marketPrice(entry: MarketEntry, rarity: Rarity | undefined): MarketPrice | undefined {
  const key = rarity ?? '';
  let byRarity = prices.get(entry);
  if (byRarity?.has(key)) return byRarity.get(key);
  const sales = rarity ? entry.sales.filter((sale) => sale.rarity === rarity) : entry.sales;
  const mean = lastMean(sales, PRICE_SALES);
  const price = mean && { average: Math.ceil(mean.price), count: sales.length };
  if (!byRarity) prices.set(entry, (byRarity = new Map<string, MarketPrice | undefined>()));
  byRarity.set(key, price);
  return price;
}
