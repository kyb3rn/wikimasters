import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  forgetGlobalCollectionPages,
  isGlobalCollectionList,
  readGlobalCollectionQuery,
  sameGlobalCollectionChoice,
  withGlobalCollectionFilters,
} from '@/site/global-collection/list';
import { netRequest } from '../../support';

const url = (search: string) => new URL(`https://www.wiki-masters.com/api/cards?${search}`);

describe('readGlobalCollectionQuery', () => {
  it('lit tri, recherche, raretés (triées), liste de souhaits et page', () => {
    expect(readGlobalCollectionQuery(url('page=2&q=tour&rarity=UR&rarity=L&sort=name&wishlist=1'))).toEqual({
      sort: 'name',
      search: 'tour',
      rarities: 'L,UR',
      wishlist: true,
      page: 2,
    });
    expect(readGlobalCollectionQuery(url('page=0&sort=rarity'))).toEqual({ sort: 'rarity', search: '', rarities: '', wishlist: false, page: 0 });
  });

  it('mêmes choix : la recherche et la page n’en sont pas', () => {
    const a = readGlobalCollectionQuery(url('page=0&q=tour&sort=rarity'));
    expect(sameGlobalCollectionChoice(a, readGlobalCollectionQuery(url('page=3&sort=rarity')))).toBe(true);
    expect(sameGlobalCollectionChoice(a, readGlobalCollectionQuery(url('page=0&sort=rarity&wishlist=1')))).toBe(false);
    expect(sameGlobalCollectionChoice(a, readGlobalCollectionQuery(url('page=0&rarity=L&sort=rarity')))).toBe(false);
  });

  it('reconnaît la lecture du catalogue seulement', () => {
    expect(isGlobalCollectionList(netRequest(url('page=0&sort=rarity')))).toBe(true);
    expect(isGlobalCollectionList(netRequest(url('page=0'), { method: 'POST' }))).toBe(false);
    expect(isGlobalCollectionList(netRequest('/api/cards/c1'))).toBe(false);
  });
});

describe('withGlobalCollectionFilters', () => {
  it('pose les filtres dans l’ordre du site, page gardée', () => {
    const next = withGlobalCollectionFilters(url('page=0&sort=rarity'), {
      sort: 'atk',
      search: 'tour eiffel',
      rarities: 'L,UR',
      wishlist: true,
      page: undefined,
    });
    expect(next.search).toBe('?page=0&q=tour+eiffel&rarity=L&rarity=UR&sort=atk&wishlist=1');
  });
});

describe('forgetGlobalCollectionPages', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('oublie les pages gardées par le site, rien d’autre', () => {
    const data = new Map([
      ['gc_v11_/api/cards?page=0', '{}'],
      ['autre', 'x'],
      ['gc_v11_/api/cards?page=1', '{}'],
    ]);
    vi.stubGlobal('sessionStorage', {
      get length() {
        return data.size;
      },
      key: (index: number) => [...data.keys()][index] ?? null,
      removeItem: (key: string) => void data.delete(key),
    });
    forgetGlobalCollectionPages();
    expect([...data.keys()]).toEqual(['autre']);
  });

  it('stockage inaccessible : sans erreur', () => {
    vi.stubGlobal('sessionStorage', {
      get length(): number {
        throw new Error('bloqué');
      },
    });
    expect(() => forgetGlobalCollectionPages()).not.toThrow();
  });
});
