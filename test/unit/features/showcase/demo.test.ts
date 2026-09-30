import { describe, expect, it } from 'vitest';
import { DEMO_CARD, demoEntry, demoSales, seededRandom } from '@/features/showcase/demo';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const DAY = 24 * 60 * 60 * 1000;

describe('ventes inventées de la vitrine', () => {
  it('sont les mêmes à chaque chargement (même graine)', () => {
    expect(demoSales(NOW)).toEqual(demoSales(NOW));
    expect(demoSales(NOW, { seed: 1 })).not.toEqual(demoSales(NOW, { seed: 2 }));
  });

  it('vont du plus ancien au plus récent, dans la période demandée', () => {
    const sales = demoSales(NOW, { count: 50, days: 30 });
    expect(sales).toHaveLength(50);
    const times = sales.map((sale) => sale.time);
    expect(times).toEqual([...times].sort((a, b) => a - b));
    expect(Math.min(...times)).toBeGreaterThanOrEqual(NOW - 30 * DAY);
    expect(Math.max(...times)).toBeLessThanOrEqual(NOW);
  });

  it('ont des prix entiers positifs et des raretés du site, surtout celle de la carte', () => {
    const sales = demoSales(NOW);
    for (const sale of sales) {
      expect(Number.isInteger(sale.price)).toBe(true);
      expect(sale.price).toBeGreaterThan(0);
      expect(['R', 'SR', 'UR']).toContain(sale.rarity);
    }
    const own = sales.filter((sale) => sale.rarity === DEMO_CARD.rarity).length;
    expect(own).toBeGreaterThan(sales.length / 3);
  });

  it('forment l’historique de la carte inventée', () => {
    const entry = demoEntry(NOW);
    expect(entry).toMatchObject({ cardId: DEMO_CARD.id, title: DEMO_CARD.title, fetchedAt: NOW - 5 * 60 * 1000 });
    expect(entry.sales.length).toBeGreaterThan(100);
  });

  it('tire des nombres entre 0 et 1', () => {
    const random = seededRandom(42);
    const values = Array.from({ length: 1000 }, random);
    expect(values.every((value) => value >= 0 && value < 1)).toBe(true);
    expect(new Set(values).size).toBe(1000);
  });
});
