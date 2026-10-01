import { describe, expect, it } from 'vitest';
import { lastMean, median, movingAverage, niceStep, salesStats } from '@/services/market/stats';
import { sale, SALES_NOW } from '../../support';

describe('statistiques des ventes', () => {
  it('médiane d’un nombre pair ou impair de valeurs', () => {
    expect(median([3, 1, 2])).toBe(2);
    expect(median([4, 1, 2, 3])).toBe(2.5);
    expect(median([])).toBeUndefined();
  });

  it('trie par date, groupe par rareté (de la plus haute), compte la rareté de la carte et les 30 derniers jours', () => {
    const stats = salesStats([sale(100, 1, 'UR'), sale(10, 60), sale(30, 40), sale(50, 10), sale(5, 2, '')], 'R', SALES_NOW);
    expect(stats.sales.map((s) => s.price)).toEqual([10, 30, 50, 5, 100]);
    expect(stats.last?.price).toBe(100);
    expect(stats.count).toBe(5);
    expect([stats.min, stats.max, stats.median, stats.mean]).toEqual([5, 100, 30, 39]);
    expect(stats.last30).toEqual({ count: 3, median: 50 });
    expect(stats.same).toEqual({ count: 3, median: 30 });
    expect(stats.byRarity.map((group) => [group.rarity, group.count, group.median, group.min, group.max])).toEqual([
      ['UR', 1, 100, 100, 100],
      ['R', 3, 30, 10, 50],
      ['?', 1, 5, 5, 5],
    ]);
  });

  it('sans vente : rien à calculer', () => {
    const stats = salesStats([], 'R', SALES_NOW);
    expect([stats.count, stats.last, stats.median, stats.min]).toEqual([0, undefined, undefined, undefined]);
    expect(stats.byRarity).toEqual([]);
  });

  it('moyenne des n dernières ventes, ou de ce qu’il y a', () => {
    const sales = [1, 2, 3, 4, 5, 6, 7, 8].map((price, index) => sale(price, 10 - index));
    expect(lastMean(sales, 7)).toEqual({ price: 5, count: 7 });
    expect(lastMean(sales.slice(0, 3), 7)).toEqual({ price: 2, count: 3 });
    expect(lastMean([], 7)).toBeUndefined();
  });

  it('moyenne mobile : départ à n − 3 ventes (au moins 2), fenêtre partielle puis complète', () => {
    expect(movingAverage([2, 4, 6, 8, 10, 12], 5)).toEqual([
      { index: 1, count: 2, price: 3, full: false },
      { index: 2, count: 3, price: 4, full: false },
      { index: 3, count: 4, price: 5, full: false },
      { index: 4, count: 5, price: 6, full: true },
      { index: 5, count: 5, price: 8, full: true },
    ]);
    expect(movingAverage([1, 2, 3], 12)).toEqual([]);
  });

  it('pas de graduation « joli »', () => {
    expect(niceStep(100, 5)).toBe(20);
    expect(niceStep(1000, 5)).toBe(200);
    expect(niceStep(12, 5)).toBe(2.5);
    expect(niceStep(7, 5)).toBe(2);
  });
});
