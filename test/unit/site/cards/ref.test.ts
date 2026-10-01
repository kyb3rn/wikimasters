import { describe, expect, it } from 'vitest';
import { parseCardRef } from '@/site/cards';

describe('parseCardRef', () => {
  it('carte telle que le site la donne : id, titre sans blancs autour, rareté', () => {
    expect(parseCardRef({ id: 'c1', wikipedia_title: ' Tour Eiffel ', rarity: 'SR', atk: 12 })).toEqual({
      id: 'c1',
      title: 'Tour Eiffel',
      rarity: 'SR',
    });
  });

  it('rareté inconnue : sans rareté ; sans id ni titre : rien', () => {
    expect(parseCardRef({ id: 'c1', wikipedia_title: 'Paris', rarity: 'X' })).toEqual({ id: 'c1', title: 'Paris', rarity: undefined });
    expect(parseCardRef({ id: '', wikipedia_title: 'Paris' })).toBeUndefined();
    expect(parseCardRef({ id: 'c1' })).toBeUndefined();
    expect(parseCardRef('c1')).toBeUndefined();
  });
});
