import { describe, expect, it } from 'vitest';
import { DEFAULT_FILTERS, pageCount, pageOf, parseFilters, sameFilters, selectCopies, wishedTotal, type ResaleFilters } from '@/features/resale/list';
import type { OwnedCopy } from '@/site/api';

function copy(id: string, extra: Partial<OwnedCopy> = {}): OwnedCopy {
  return {
    id,
    cardId: `card-${id}`,
    title: `Carte ${id}`,
    category: '',
    image: undefined,
    rarity: 'C',
    shiny: false,
    atk: 0,
    def: 0,
    starred: false,
    obtainedAt: 0,
    siteCard: {},
    ...extra,
  };
}

const ids = (copies: readonly OwnedCopy[]) => copies.map((c) => c.id);
const filters = (change: Partial<ResaleFilters>): ResaleFilters => ({ ...DEFAULT_FILTERS, ...change });

describe('cartes à vendre : filtres et tri', () => {
  it('tri par défaut : prix du plus haut au plus bas, sans prix en fin, ex aequo par date d’ajout la plus récente', () => {
    const copies = [
      copy('sans-vieux', { obtainedAt: 1 }),
      copy('100', { obtainedAt: 1 }),
      copy('300'),
      copy('100-recent', { obtainedAt: 5 }),
      copy('sans-recent', { obtainedAt: 9 }),
    ];
    const prices: Record<string, number> = { '100': 100, '300': 300, '100-recent': 100 };
    expect(ids(selectCopies(copies, DEFAULT_FILTERS, (c) => prices[c.id]))).toEqual(['300', '100-recent', '100', 'sans-recent', 'sans-vieux']);
  });

  it('rareté (L → C, puis la plus récente), nom (A → Z, comme en français), date d’ajout', () => {
    const copies = [copy('c', { rarity: 'C', title: 'éclair' }), copy('l', { rarity: 'L', title: 'Zèbre', obtainedAt: 2 }), copy('ur', { rarity: 'UR', title: 'Abricot', obtainedAt: 3 })];
    const none = () => undefined;
    expect(ids(selectCopies(copies, filters({ sort: 'rarity' }), none))).toEqual(['l', 'ur', 'c']);
    expect(ids(selectCopies(copies, filters({ sort: 'name', order: 'asc' }), none))).toEqual(['ur', 'c', 'l']);
    expect(ids(selectCopies(copies, filters({ sort: 'added' }), none))).toEqual(['ur', 'l', 'c']);
  });

  it('recherche dans le titre et la catégorie, sans accents ni casse ; raretés de l’exemplaire', () => {
    const copies = [copy('a', { title: 'Élysée', rarity: 'SR' }), copy('b', { category: 'Président de la République', rarity: 'R' }), copy('c')];
    const none = () => undefined;
    expect(ids(selectCopies(copies, filters({ search: '  ELYS ', sort: 'added' }), none))).toEqual(['a']);
    expect(ids(selectCopies(copies, filters({ search: 'republique', sort: 'added' }), none))).toEqual(['b']);
    expect(ids(selectCopies(copies, filters({ rarities: ['SR', 'R'], sort: 'name', order: 'asc' }), none))).toEqual(['b', 'a']);
  });

  it('pages de 50', () => {
    const items = Array.from({ length: 120 }, (_, i) => i);
    expect(pageCount(0)).toBe(1);
    expect(pageCount(120)).toBe(3);
    expect(pageOf(items, 3)).toEqual(items.slice(100));
  });

  it('filtres retenus : relus s’ils sont valides, comparés sans les blancs de la recherche', () => {
    // Retenus avant le sens du tri : celui du tri.
    expect(parseFilters({ search: 'x', rarities: ['C', 'L', 'Z'], sort: 'name' })).toEqual({ search: 'x', rarities: ['L', 'C'], sort: 'name', order: 'asc' });
    expect(parseFilters({ search: '', rarities: [], sort: 'price', order: 'asc' })?.order).toBe('asc');
    expect(sameFilters(filters({ order: 'asc' }), DEFAULT_FILTERS)).toBe(false);
    expect(parseFilters({ search: 'x', rarities: [], sort: 'autre' })).toBeUndefined();
    expect(sameFilters(filters({ search: 'abc ' }), filters({ search: 'abc' }))).toBe(true);
    expect(sameFilters(filters({ rarities: ['L'] }), DEFAULT_FILTERS)).toBe(false);
  });
});

describe('sens du tri', () => {
  const none = () => undefined;

  it('croissant : le moins cher d’abord, sans prix toujours en fin, ex aequo la plus récente d’abord', () => {
    const copies = [copy('sans', { obtainedAt: 9 }), copy('300'), copy('100-vieux', { obtainedAt: 1 }), copy('100-recent', { obtainedAt: 5 })];
    const prices: Record<string, number> = { '300': 300, '100-vieux': 100, '100-recent': 100 };
    expect(ids(selectCopies(copies, filters({ order: 'asc' }), (c) => prices[c.id]))).toEqual(['100-recent', '100-vieux', '300', 'sans']);
  });

  it('rareté, nom et date d’ajout dans les deux sens', () => {
    const copies = [copy('c', { rarity: 'C', title: 'Éclair', obtainedAt: 1 }), copy('l', { rarity: 'L', title: 'Zèbre', obtainedAt: 2 }), copy('ur', { rarity: 'UR', title: 'Abricot', obtainedAt: 3 })];
    expect(ids(selectCopies(copies, filters({ sort: 'rarity', order: 'asc' }), none))).toEqual(['c', 'ur', 'l']);
    expect(ids(selectCopies(copies, filters({ sort: 'name', order: 'desc' }), none))).toEqual(['l', 'c', 'ur']);
    expect(ids(selectCopies(copies, filters({ sort: 'added', order: 'asc' }), none))).toEqual(['c', 'l', 'ur']);
  });
});

describe('total des prix souhaités', () => {
  it('somme des exemplaires présents, chacun une fois ; ceux sans prix comptés à part', () => {
    const copies = [copy('a'), copy('a2', { cardId: 'card-a' }), copy('b'), copy('c')];
    const wished: Record<string, number> = { 'card-a': 100, 'card-b': 30 };
    expect(wishedTotal(copies, (c) => wished[c.cardId])).toEqual({ total: 230, missing: 1 });
    expect(wishedTotal([], () => 1)).toEqual({ total: 0, missing: 0 });
  });
});
