import { describe, expect, it } from 'vitest';
import type { NetRequest } from '@/core/net';
import {
  isMarketplaceAppend,
  isMarketplaceList,
  isMarketplaceMineRefresh,
  readMarketplaceQuery,
  sameMarketplaceChoice,
  withMarketplaceFilters,
} from '@/site/marketplace';

const url = (search: string) => new URL(`https://www.wiki-masters.com/api/marketplace?${search}`);
const request = (search: string): NetRequest => ({ url: url(search), method: 'GET', headers: new Headers(), body: undefined, own: false });

describe('liste du marché', () => {
  it('la relecture des listes personnelles n’est pas une liste', () => {
    expect(isMarketplaceList(request('page=1&limit=50&sort=recent&mine=1'))).toBe(true);
    expect(isMarketplaceList(request('page=1&limit=1&mine=1'))).toBe(false);
    expect(isMarketplaceMineRefresh(request('page=1&limit=1&mine=1'))).toBe(true);
  });

  it('lit tri, recherche, raretés et page ; « Charger la suite » à partir de la page 2', () => {
    const query = readMarketplaceQuery(url('page=2&limit=50&sort=price_asc&q=tour&rarity=UR&rarity=L'));
    expect(query).toEqual({ sort: 'price_asc', search: 'tour', rarities: 'L,UR', page: 2 });
    expect(isMarketplaceAppend(query)).toBe(true);
    expect(isMarketplaceAppend(readMarketplaceQuery(url('page=1&limit=50&sort=recent')))).toBe(false);
    expect(sameMarketplaceChoice(query, readMarketplaceQuery(url('page=1&limit=50&sort=price_asc&rarity=L&rarity=UR')))).toBe(true);
  });

  it('pose les filtres dans l’ordre du site, page, taille et `mine` gardés', () => {
    const next = withMarketplaceFilters(url('page=1&limit=50&sort=recent&mine=1'), {
      sort: 'ending_soon',
      search: 'tour',
      rarities: 'L,SR',
      page: undefined,
    });
    expect(next.search).toBe('?page=1&limit=50&sort=ending_soon&mine=1&q=tour&rarity=L&rarity=SR');
  });
});
