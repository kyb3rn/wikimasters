import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { CardSales } from '@/site/api';

const fetchCardSales = vi.fn<(cardId: string) => Promise<CardSales>>();
vi.mock('@/site/api', async (original) => ({ ...(await original<object>()), fetchCardSales }));

const { cachedMarket, fetchMarket, isStale, marketSettings, onMarketChange } = await import('@/services/market');

const CARD = { id: 'c1', title: 'Tour Eiffel', rarity: 'C' as const };
const SALES: CardSales = {
  title: '',
  sales: [
    { id: 's1', price: 12, time: 2, rarity: 'C' },
    { id: 's0', price: 8, time: 1, rarity: 'C' },
  ],
};

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  });
  fetchCardSales.mockReset();
});
afterEach(() => vi.unstubAllGlobals());

describe('ventes d’une carte (cache)', () => {
  it('une seule requête pour des demandes simultanées ; ventes triées, en cache, abonnés prévenus', async () => {
    let answer: (sales: CardSales) => void = () => {};
    fetchCardSales.mockReturnValue(new Promise((resolve) => (answer = resolve)));
    const seen: string[] = [];
    const controller = new AbortController();
    onMarketChange((entry) => seen.push(entry.cardId), { signal: controller.signal });

    const first = fetchMarket(CARD);
    const second = fetchMarket(CARD);
    answer(SALES);
    const [a, b] = await Promise.all([first, second]);
    expect(fetchCardSales).toHaveBeenCalledTimes(1);
    expect(a).toBe(b);
    expect(a.title).toBe('Tour Eiffel');
    expect(a.sales.map((sale) => sale.id)).toEqual(['s0', 's1']);
    expect(await cachedMarket('c1')).toMatchObject({ cardId: 'c1', title: 'Tour Eiffel' });
    expect(seen).toEqual(['c1']);

    controller.abort();
    fetchCardSales.mockResolvedValue(SALES);
    await fetchMarket(CARD);
    expect(fetchCardSales).toHaveBeenCalledTimes(2);
    expect(seen).toEqual(['c1']);
  });

  it('échec du site : l’erreur remonte, rien n’est écrit', async () => {
    fetchCardSales.mockRejectedValue(new Error('erreur 500 du site'));
    await expect(fetchMarket({ ...CARD, id: 'c2' })).rejects.toThrow('erreur 500 du site');
    expect(await cachedMarket('c2')).toBeUndefined();
  });

  it('périmées au-delà de la durée du cache (réglage, 48 h par défaut)', () => {
    const entry = { cardId: 'c1', title: '', fetchedAt: 0, sales: [] };
    const HOUR = 3_600_000;
    expect(isStale(entry, 47 * HOUR)).toBe(false);
    expect(isStale(entry, 49 * HOUR)).toBe(true);
    marketSettings.set('cacheHours', 2);
    expect(isStale(entry, 3 * HOUR)).toBe(true);
    expect(isStale(entry, 1 * HOUR)).toBe(false);
  });
});
