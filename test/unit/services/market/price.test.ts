import { describe, expect, it } from 'vitest';
import type { MarketEntry } from '@/services/market';
import { marketPrice } from '@/services/market/price';
import { sale } from '../../support';

const entryOf = (sales: MarketEntry['sales']): MarketEntry => ({ cardId: 'c1', title: 'Carte', fetchedAt: 0, sales });

describe('prix moyen d’une carte', () => {
  it('moyenne des 7 dernières ventes de la rareté, arrondie au-dessus ; nombre de ventes de la rareté', () => {
    const prices = [100, 1, 2, 3, 4, 5, 6, 8];
    const entry = entryOf([...prices.map((price, index) => sale(price, 20 - index, 'SR')), sale(900, 1, 'UR')]);
    // 1 + 2 + 3 + 4 + 5 + 6 + 8 = 29, sur 7 : 4,14… → 5. La vente à 100, la plus ancienne, n'en est plus.
    expect(marketPrice(entry, 'SR')).toEqual({ average: 5, count: 8 });
    expect(marketPrice(entry, 'UR')).toEqual({ average: 900, count: 1 });
  });

  it('moins de 7 ventes : moyenne de ce qu’il y a', () => {
    expect(marketPrice(entryOf([sale(10, 3), sale(11, 2)]), 'R')).toEqual({ average: 11, count: 2 });
  });

  it('aucune vente dans la rareté (même s’il y en a ailleurs) : pas de prix ; rareté inconnue : toutes', () => {
    const entry = entryOf([sale(10, 3, 'R'), sale(30, 2, 'SR')]);
    expect(marketPrice(entry, 'L')).toBeUndefined();
    expect(marketPrice(entryOf([]), 'R')).toBeUndefined();
    expect(marketPrice(entry, undefined)).toEqual({ average: 20, count: 2 });
  });
});
