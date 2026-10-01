import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  isMarketplaceAppend,
  isMarketplaceList,
  isMarketplaceMineRefresh,
  readMarketplaceKeptQuery,
  readMarketplaceQuery,
  sameMarketplaceChoice,
  withMarketplaceFilters,
} from '@/site/marketplace/list';
import { netRequest } from '../../support';

const url = (search: string) => new URL(`https://www.wiki-masters.com/api/marketplace?${search}`);
const request = (search: string) => netRequest(url(search));

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

describe('liste gardée par le site au retour d’une annonce', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });
  const keep = (value: string | null) => vi.stubGlobal('sessionStorage', { getItem: () => value });

  it('filtres de la recherche lancée, raretés triées', () => {
    keep(JSON.stringify({ search: 'tou', submittedSearch: 'tour', sort: 'price_asc', rarityFilter: ['UR', 'L'], browse: [] }));
    expect(readMarketplaceKeptQuery()).toEqual({ sort: 'price_asc', search: 'tour', rarities: 'L,UR', page: 1 });
  });

  it('rien de gardé ou illisible : aucune liste', () => {
    keep(null);
    expect(readMarketplaceKeptQuery()).toBeUndefined();
    keep('{');
    expect(readMarketplaceKeptQuery()).toBeUndefined();
    keep(JSON.stringify({ submittedSearch: 'tour', sort: 'recent', rarityFilter: [1] }));
    expect(readMarketplaceKeptQuery()).toBeUndefined();
  });
});
