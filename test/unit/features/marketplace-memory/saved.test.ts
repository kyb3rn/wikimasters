import { describe, expect, it } from 'vitest';
import { parseSavedFilters } from '@/features/marketplace-memory';

describe('filtres retenus du marché', () => {
  it('tri, recherche, raretés', () => {
    const saved = { sort: 'price_asc', search: '', rarities: 'L,UR' };
    expect(parseSavedFilters(saved)).toEqual(saved);
    expect(parseSavedFilters({ sort: 'recent' })).toBeUndefined();
    expect(parseSavedFilters(null)).toBeUndefined();
  });
});
