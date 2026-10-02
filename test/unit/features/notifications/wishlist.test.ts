import { describe, expect, it } from 'vitest';
import { parseRemovedWishes, returnedCards, wishedIn, withoutRemoved, withRemoved } from '@/features/notifications/wishlist';

describe('cartes retirées de la liste de souhaits', () => {
  it('une carte notifiée est dans la liste, sauf retrait retenu', () => {
    expect(wishedIn({}, 'c1')).toBe(true);
    expect(wishedIn({ c1: 1000 }, 'c1')).toBe(false);
  });

  it('retient le dernier retrait de chaque carte, les plus anciens partent au-delà du maximum', () => {
    const removed = withRemoved(withRemoved(withRemoved({}, 'c1', 1), 'c2', 2), 'c1', 3, 2);
    expect(Object.entries(removed)).toEqual([
      ['c2', 2],
      ['c1', 3],
    ]);
    expect(Object.keys(withRemoved(removed, 'c3', 4, 2))).toEqual(['c1', 'c3']);
    expect(withoutRemoved(removed, ['c1'])).toEqual({ c2: 2 });
  });

  it('carte notifiée après son retrait : remise dans la liste ; notification plus ancienne : rien', () => {
    const removed = { c1: 1000, c2: 1000 };
    const listings = [
      { cardId: 'c1', time: 900 },
      { cardId: 'c2', time: 1500 },
      { cardId: 'c2', time: 1600 },
      { cardId: 'c3', time: 2000 },
    ];
    expect(returnedCards(removed, listings)).toEqual(['c2']);
  });

  it('relit le stockage, valeurs illisibles ignorées', () => {
    expect(parseRemovedWishes({ c1: 1000, c2: 'hier', c3: null })).toEqual({ c1: 1000 });
    expect(parseRemovedWishes([])).toBeUndefined();
  });
});
