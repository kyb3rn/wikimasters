import { describe, expect, it } from 'vitest';
import type { NetRequest } from '@/core/net';
import { parseCardSales, readSalesRequest } from '@/site/api';

const request = (url: string, method = 'GET'): NetRequest => ({
  url: new URL(url, 'https://www.wiki-masters.com'),
  method,
  headers: new Headers(),
  body: undefined,
  own: false,
});

describe('ventes d’une carte', () => {
  it('lit les ventes du site (prix, date, rareté) et écarte les illisibles', () => {
    const sales = parseCardSales({
      wikipedia_title: 'Tour Eiffel',
      sales: [
        { id: 's1', final_price: 11, settled_at: '2026-09-24T11:33:37.712432+00:00', rarity: 'PC' },
        { id: 's2', final_price: 'x', settled_at: '2026-09-25T00:00:00Z', rarity: 'C' },
        { id: 's3', final_price: 20, settled_at: 'pas une date', rarity: 'C' },
        { id: 's4', final_price: 7, settled_at: '2026-09-26T00:00:00Z' },
      ],
      recent: [],
    });
    expect(sales).toEqual({
      title: 'Tour Eiffel',
      sales: [
        { id: 's1', price: 11, time: Date.parse('2026-09-24T11:33:37.712Z'), rarity: 'PC' },
        { id: 's4', price: 7, time: Date.parse('2026-09-26T00:00:00Z'), rarity: '' },
      ],
    });
  });

  it('rejette une réponse sans liste de ventes (résumé, erreur)', () => {
    expect(parseCardSales({ wikipedia_title: 'x', summary: {}, isPro: true })).toBeUndefined();
    expect(parseCardSales({ error: 'Erreur' })).toBeUndefined();
  });

  it('reconnaît la demande des ventes, pas celle du résumé ni une autre route', () => {
    expect(readSalesRequest(request('/api/marketplace/cards/c1/sales'))).toBe('c1');
    expect(readSalesRequest(request('/api/marketplace/cards/c1/sales?scope=summary'))).toBeUndefined();
    expect(readSalesRequest(request('/api/marketplace/cards/c1/sales', 'POST'))).toBeUndefined();
    expect(readSalesRequest(request('/api/marketplace/c1'))).toBeUndefined();
  });
});
