import { describe, expect, it } from 'vitest';
import { parseSavedFilters } from '@/features/global-collection-memory';

describe('filtres retenus de Toutes les cartes', () => {
  it('tri, recherche, raretés, liste de souhaits', () => {
    const saved = { sort: 'name', search: 'tour', rarities: 'L', wishlist: true };
    expect(parseSavedFilters(saved)).toEqual(saved);
    expect(parseSavedFilters({ ...saved, wishlist: 'oui' })).toBeUndefined();
    expect(parseSavedFilters({ ...saved, sort: '' })).toBeUndefined();
  });
});
