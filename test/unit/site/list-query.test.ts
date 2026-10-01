import { describe, expect, it } from 'vitest';
import { appendRarities, checkedRarities, readBaseListQuery, splitRarities } from '@/site/list-query';
import type { RarityPills } from '@/site/rarity-pills';

describe('requêtes des listes', () => {
  it('lit tri, recherche, raretés (triées) et page', () => {
    expect(readBaseListQuery(new URLSearchParams('page=2&q=tour&rarity=UR&rarity=L&sort=name'))).toEqual({
      sort: 'name',
      search: 'tour',
      rarities: 'L,UR',
      page: 2,
    });
    // Compteurs de la Collection : sans page.
    expect(readBaseListQuery(new URLSearchParams('sort=rarity'))).toEqual({ sort: 'rarity', search: '', rarities: '', page: undefined });
    expect(readBaseListQuery(new URLSearchParams('page=x')).page).toBeUndefined();
  });

  it('raretés : ajoutées une par une, relues des pastilles cochées comme dans une requête', () => {
    expect(splitRarities('L,SR')).toEqual(['L', 'SR']);
    expect(splitRarities('')).toEqual([]);
    const params = new URLSearchParams('sort=rarity');
    appendRarities(params, 'L,SR');
    appendRarities(params, '');
    expect(params.toString()).toBe('sort=rarity&rarity=L&rarity=SR');
    const pill = (rarity: 'L' | 'SR' | 'C', checked: boolean) => ({ rarity, checked, button: {} as HTMLButtonElement });
    const pills: RarityPills = { row: {} as HTMLElement, pills: [pill('SR', true), pill('L', true), pill('C', false)], reset: undefined };
    expect(checkedRarities(pills)).toBe('L,SR');
  });
});
