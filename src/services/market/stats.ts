import type { Sale } from '@/site/api';
import { RARITIES } from '@/site/rarity';

const DAY = 86_400_000;

/** Rareté d'une vente pour les regroupements (`?` : inconnue). */
export const saleRarity = (sale: Sale): string => sale.rarity || '?';

export function median(values: readonly number[]): number | undefined {
  if (values.length === 0) return undefined;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = sorted.length >> 1;
  return sorted.length % 2 ? sorted[middle] : ((sorted[middle - 1] ?? 0) + (sorted[middle] ?? 0)) / 2;
}

const mean = (values: readonly number[]) =>
  values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : undefined;

export interface RarityStats {
  readonly rarity: string;
  readonly count: number;
  readonly median: number;
  readonly min: number;
  readonly max: number;
}

export interface SalesStats {
  /** Du plus ancien au plus récent. */
  readonly sales: readonly Sale[];
  readonly count: number;
  readonly last: Sale | undefined;
  readonly median: number | undefined;
  readonly mean: number | undefined;
  readonly min: number | undefined;
  readonly max: number | undefined;
  /** Ventes des 30 derniers jours. */
  readonly last30: { readonly count: number; readonly median: number | undefined };
  /** Ventes de la rareté demandée (celle de la carte). */
  readonly same: { readonly count: number; readonly median: number | undefined };
  /** Par rareté, de la plus haute à la plus basse. */
  readonly byRarity: readonly RarityStats[];
}

const rarityRank = (rarity: string) => {
  const rank = RARITIES.findIndex((known) => known === rarity);
  return rank < 0 ? RARITIES.length : rank;
};

export function salesStats(input: readonly Sale[], rarity: string | undefined, now = Date.now()): SalesStats {
  const sales = [...input].sort((a, b) => a.time - b.time);
  const prices = sales.map((sale) => sale.price);
  const recent = sales.filter((sale) => now - sale.time <= 30 * DAY).map((sale) => sale.price);
  const groups = new Map<string, number[]>();
  for (const sale of sales) {
    const key = saleRarity(sale);
    groups.set(key, [...(groups.get(key) ?? []), sale.price]);
  }
  const byRarity = [...groups]
    .sort(([a], [b]) => rarityRank(a) - rarityRank(b))
    .map(([key, values]) => ({
      rarity: key,
      count: values.length,
      median: median(values) ?? 0,
      min: Math.min(...values),
      max: Math.max(...values),
    }));
  const same = (rarity && groups.get(rarity)) || [];
  return {
    sales,
    count: sales.length,
    last: sales.at(-1),
    median: median(prices),
    mean: mean(prices),
    min: prices.length ? Math.min(...prices) : undefined,
    max: prices.length ? Math.max(...prices) : undefined,
    last30: { count: recent.length, median: median(recent) },
    same: { count: same.length, median: median(same) },
    byRarity,
  };
}

/** Moyenne des `n` dernières ventes (ou de ce qu'il y a) d'une liste triée par date. */
export function lastMean(sales: readonly Sale[], n: number): { readonly price: number; readonly count: number } | undefined {
  const prices = sales.slice(-n).map((sale) => sale.price);
  const value = mean(prices);
  return value === undefined ? undefined : { price: value, count: prices.length };
}

export interface AveragePoint {
  /** Indice de la vente où le point est posé. */
  readonly index: number;
  /** Ventes moyennées. */
  readonly count: number;
  readonly price: number;
  /** Fenêtre complète (`count` = n). */
  readonly full: boolean;
}

/**
 * Moyenne mobile simple sur les `n` dernières ventes. La courbe démarre dès `n − 3` ventes (au moins 2),
 * moyennées sur ce qu'on a : ces premiers points ont une fenêtre partielle.
 */
export function movingAverage(prices: readonly number[], n: number): AveragePoint[] {
  const minCount = Math.max(2, n - 3);
  const points: AveragePoint[] = [];
  let sum = 0;
  for (let index = 0; index < prices.length; index++) {
    sum += prices[index] ?? 0;
    if (index >= n) sum -= prices[index - n] ?? 0;
    const count = Math.min(index + 1, n);
    if (count >= minCount) points.push({ index, count, price: sum / count, full: count >= n });
  }
  return points;
}

/** Pas « joli » de graduation (1, 2, 2,5 ou 5 × 10^k) pour environ `n` graduations sur `span`. */
export function niceStep(span: number, n: number): number {
  const raw = span / Math.max(1, n);
  const magnitude = 10 ** Math.floor(Math.log10(raw));
  const ratio = raw / magnitude;
  return (ratio <= 1 ? 1 : ratio <= 2 ? 2 : ratio <= 2.5 ? 2.5 : ratio <= 5 ? 5 : 10) * magnitude;
}
