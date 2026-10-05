import { describe, expect, it } from 'vitest';
import { savedFiltersDetails } from '@/services/list-search/data';

describe('filtres retenus en clair', () => {
  it('ce qui filtre, dans l’ordre des filtres', () => {
    expect(savedFiltersDetails({ sort: 'recent', tag: 'untagged', search: ' rome ', rarities: 'L,UR', wishlist: true })).toEqual([
      'Tri : recent',
      'Sans étiquette',
      'Recherche : « rome »',
      'Raretés : L, UR',
      'Liste de souhaits',
    ]);
    expect(savedFiltersDetails({ tag: 'b2c4', search: '', rarities: '' })).toEqual(['Une étiquette']);
    expect(savedFiltersDetails({ search: '', rarities: '', wishlist: false })).toEqual(['Aucun filtre']);
  });
});
