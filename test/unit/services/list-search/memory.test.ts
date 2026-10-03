import { describe, expect, it } from 'vitest';
import { applyRarities, parseSavedFilters, parseSavedList } from '@/services/list-search/memory';
import type { CollectionQuery } from '@/site/collection';
import type { GlobalCollectionQuery } from '@/site/global-collection';
import type { MarketplaceQuery } from '@/site/marketplace';
import type { RarityPills } from '@/site/rarity-pills';

describe('filtres retenus', () => {
  it('Collection : tri (non vide), étiquette, recherche, raretés ; forme inattendue rejetée', () => {
    const shape = { sort: 'text', tag: 'string', search: 'string', rarities: 'string' } as const;
    const saved = { sort: 'name', tag: 't1', search: 'tour', rarities: 'L,SR' };
    expect(parseSavedFilters<CollectionQuery>(saved, shape)).toEqual(saved);
    expect(parseSavedFilters<CollectionQuery>({ ...saved, extra: 1 }, shape)).toEqual(saved);
    expect(parseSavedFilters<CollectionQuery>({ ...saved, tag: '' }, shape)).toEqual({ ...saved, tag: '' });
    expect(parseSavedFilters<CollectionQuery>({ ...saved, sort: '' }, shape)).toBeUndefined();
    expect(parseSavedFilters<CollectionQuery>({ sort: 'name', tag: 't1' }, shape)).toBeUndefined();
    expect(parseSavedFilters<CollectionQuery>(null, shape)).toBeUndefined();
    expect(parseSavedFilters<CollectionQuery>('name', shape)).toBeUndefined();
  });

  it('Toutes les cartes : liste de souhaits en booléen', () => {
    const shape = { sort: 'text', search: 'string', rarities: 'string', wishlist: 'boolean' } as const;
    const saved = { sort: 'name', search: 'tour', rarities: 'L', wishlist: true };
    expect(parseSavedFilters<GlobalCollectionQuery>(saved, shape)).toEqual(saved);
    expect(parseSavedFilters<GlobalCollectionQuery>({ ...saved, wishlist: 'oui' }, shape)).toBeUndefined();
  });

  it('marché : tri, recherche, raretés', () => {
    const shape = { sort: 'text', search: 'string', rarities: 'string' } as const;
    expect(parseSavedFilters<MarketplaceQuery>({ sort: 'price_asc', search: '', rarities: 'L,UR' }, shape)).toEqual({
      sort: 'price_asc',
      search: '',
      rarities: 'L,UR',
    });
    expect(parseSavedFilters<MarketplaceQuery>({ sort: 'recent' }, shape)).toBeUndefined();
  });
});

describe('liste gardée', () => {
  const shape = { sort: 'text', search: 'string', rarities: 'string', wishlist: 'boolean' } as const;
  const filters = { sort: 'name', search: '', rarities: '', wishlist: false };
  const response = { body: '{"cards":[]}', contentType: 'application/json' };

  it('Toutes les cartes : filtres et réponse ; forme inattendue rejetée', () => {
    expect(parseSavedList<GlobalCollectionQuery>({ filters, response }, shape)).toEqual({ filters, response });
    expect(parseSavedList<GlobalCollectionQuery>({ filters: { ...filters, sort: '' }, response }, shape)).toBeUndefined();
    expect(parseSavedList<GlobalCollectionQuery>({ filters, response: { body: {}, contentType: 'application/json' } }, shape)).toBeUndefined();
    expect(parseSavedList<GlobalCollectionQuery>({ filters, response: { body: '' } }, shape)).toBeUndefined();
    expect(parseSavedList<GlobalCollectionQuery>({ filters }, shape)).toBeUndefined();
    expect(parseSavedList<GlobalCollectionQuery>(null, shape)).toBeUndefined();
  });
});

describe('applyRarities', () => {
  it('clique les pastilles qui ne sont pas comme voulu, et seulement elles', () => {
    const clicked: string[] = [];
    const pill = (rarity: 'L' | 'SR' | 'C', checked: boolean) => ({
      rarity,
      checked,
      button: { click: () => clicked.push(rarity) } as unknown as HTMLButtonElement,
    });
    const pills: RarityPills = { row: {} as HTMLElement, pills: [pill('L', true), pill('SR', false), pill('C', true)], reset: undefined };
    expect(applyRarities(pills, 'L,SR')).toBe(true);
    expect(clicked).toEqual(['SR', 'C']);
    clicked.length = 0;
    const done: RarityPills = { ...pills, pills: [pill('L', true), pill('SR', true), pill('C', false)] };
    expect(applyRarities(done, 'L,SR')).toBe(false);
    expect(clicked).toEqual([]);
  });
});
