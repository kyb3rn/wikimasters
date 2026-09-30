import { describe, expect, it } from 'vitest';
import { SEARCH_DELAY, searchWait } from '@/features/collection-search-delay/state';
import { readCollectionQuery, SEARCH_TYPING_DELAY } from '@/site/collection';

const read = (search: string) => readCollectionQuery(new URL(`https://www.wiki-masters.com/api/my-collection${search}`));

describe('searchWait', () => {
  it('mêmes filtres (autre page, actualisation) ou première requête : aucune attente', () => {
    expect(searchWait(read('?sort=rarity&page=1'), read('?sort=rarity&page=0'))).toBe(0);
    expect(searchWait(read('?sort=rarity&rarity=R&page=0'), read('?sort=rarity&rarity=R&page=0'))).toBe(0);
    expect(searchWait(read('?sort=rarity&page=0'), undefined)).toBe(0);
  });

  it('liste, étiquette ou rareté changée : toute l’attente', () => {
    expect(searchWait(read('?sort=name&page=0'), read('?sort=rarity&page=3'))).toBe(SEARCH_DELAY);
    expect(searchWait(read('?sort=rarity&tag_id=t1'), read('?sort=rarity'))).toBe(SEARCH_DELAY);
    expect(searchWait(read('?sort=rarity&rarity=R&rarity=C'), read('?sort=rarity&rarity=R'))).toBe(SEARCH_DELAY);
  });

  it('recherche changée : le site a déjà attendu après la frappe', () => {
    expect(searchWait(read('?sort=rarity&q=tour'), read('?sort=rarity'))).toBe(SEARCH_DELAY - SEARCH_TYPING_DELAY);
  });
});
