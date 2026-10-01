import { describe, expect, it } from 'vitest';
import { isSourceRequest, sameFilters } from '@/services/list-search/types';
import { collectionList } from '@/site/collection';
import { netRequest } from '../../support';

describe('requêtes et filtres d’une liste', () => {
  it('requête de la liste ou de sa compagne, venue de la page (pas du script)', () => {
    const isSource = isSourceRequest(collectionList);
    expect(isSource(netRequest('/api/my-collection?sort=rarity&page=0&stats=0'))).toBe(true);
    expect(isSource(netRequest('/api/my-collection/stats?sort=rarity'))).toBe(true);
    expect(isSource(netRequest('/api/my-collection?sort=rarity&page=0&stats=0', { own: true }))).toBe(false);
    expect(isSource(netRequest('/api/cards?page=0'))).toBe(false);
  });

  it('mêmes filtres : mêmes choix et même recherche, quelle que soit la page', () => {
    const read = (search: string) => collectionList.readQuery(new URL(`https://www.wiki-masters.com/api/my-collection?${search}`));
    const base = read('sort=rarity&q=tour&page=0');
    expect(sameFilters(collectionList, base, read('sort=rarity&q=tour&page=4'))).toBe(true);
    expect(sameFilters(collectionList, base, read('sort=rarity&page=0'))).toBe(false);
    expect(sameFilters(collectionList, base, read('sort=name&q=tour&page=0'))).toBe(false);
  });
});
