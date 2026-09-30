import { describe, expect, it } from 'vitest';
import { readCollectionQuery, sameFilters, sameListChoice, sameOtherFilters, withCollectionFilters } from '@/site/collection';

const read = (search: string) => readCollectionQuery(new URL(`https://www.wiki-masters.com/api/my-collection${search}`));

describe('filtres de la collection', () => {
  it('lit tri, étiquette, recherche, raretés (dans l’ordre) et page', () => {
    expect(read('?sort=name&q=tour&rarity=SR&rarity=L&tag_id=t1&page=2&stats=0')).toEqual({
      sort: 'name',
      tag: 't1',
      search: 'tour',
      rarities: 'L,SR',
      page: 2,
    });
    expect(read('?sort=rarity&untagged=1').tag).toBe('untagged');
    // Compteurs : pas de page.
    expect(read('?sort=rarity').page).toBeUndefined();
  });

  it('distingue les choix (étiquette, tri, raretés) de la recherche', () => {
    const base = read('?sort=rarity&page=3&stats=0');
    expect(sameListChoice(base, read('?sort=rarity&page=0&stats=0&q=tour'))).toBe(true);
    expect(sameListChoice(base, read('?sort=name&page=3'))).toBe(false);
    expect(sameListChoice(base, read('?sort=rarity&untagged=1'))).toBe(false);
    expect(sameListChoice(base, read('?sort=rarity&rarity=C'))).toBe(false);
    expect(sameOtherFilters(base, read('?sort=name&tag_id=t1&rarity=C&page=0'))).toBe(true);
    expect(sameOtherFilters(base, read('?sort=rarity&q=tour'))).toBe(false);
    expect(sameFilters(base, read('?sort=rarity&page=0'))).toBe(true);
    expect(sameFilters(base, read('?sort=rarity&q=tour'))).toBe(false);
  });

  it('refait l’adresse avec d’autres filtres, page et `stats` gardés, dans l’ordre du site', () => {
    const list = new URL('https://www.wiki-masters.com/api/my-collection?sort=rarity&page=0&stats=0');
    const target = read('?sort=name&q=tour&rarity=SR&rarity=L&tag_id=t1');
    expect(withCollectionFilters(list, target).search).toBe('?sort=name&q=tour&rarity=L&rarity=SR&tag_id=t1&page=0&stats=0');
    const stats = new URL('https://www.wiki-masters.com/api/my-collection/stats?sort=rarity&rarity=C');
    expect(withCollectionFilters(stats, read('?sort=added&untagged=1')).href).toBe(
      'https://www.wiki-masters.com/api/my-collection/stats?sort=added&untagged=1',
    );
  });
});
