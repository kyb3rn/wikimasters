import { describe, expect, it } from 'vitest';
import { parseSavedFilters, toSaved } from '@/features/collection-memory/memory';
import { readCollectionQuery } from '@/site/collection';

describe('filtres retenus', () => {
  it('relit les filtres enregistrés, rejette une forme inattendue', () => {
    const saved = { sort: 'name', tag: 't1', search: 'tour', rarities: 'L,SR' };
    expect(parseSavedFilters(saved)).toEqual(saved);
    expect(parseSavedFilters({ ...saved, extra: 1 })).toEqual(saved);
    expect(parseSavedFilters({ ...saved, sort: '' })).toBeUndefined();
    expect(parseSavedFilters({ sort: 'name', tag: 't1' })).toBeUndefined();
    expect(parseSavedFilters(null)).toBeUndefined();
    expect(parseSavedFilters('name')).toBeUndefined();
  });

  it('garde les filtres d’une requête, pas sa page', () => {
    const query = readCollectionQuery(new URL('https://www.wiki-masters.com/api/my-collection?sort=name&q=tour&rarity=R&untagged=1&page=3&stats=0'));
    expect(toSaved(query)).toEqual({ sort: 'name', tag: 'untagged', search: 'tour', rarities: 'R' });
  });
});
