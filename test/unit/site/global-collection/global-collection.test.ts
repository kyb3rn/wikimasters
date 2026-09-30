import { describe, expect, it } from 'vitest';
import type { Fiber } from '@/core/react';
import {
  globalCollectionStatesAmong,
  readGlobalCollectionPageLabel,
  readGlobalCollectionQuery,
  sameGlobalCollectionChoice,
  withGlobalCollectionFilters,
} from '@/site/global-collection';

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

describe('readGlobalCollectionPageLabel', () => {
  it('avec ou sans total', () => {
    expect(readGlobalCollectionPageLabel('Page 3 / 120')).toEqual({ page: 3, total: 120 });
    expect(readGlobalCollectionPageLabel('Page 2 · suite disponible')).toEqual({ page: 2, hasNext: true });
    expect(readGlobalCollectionPageLabel('Page 4')).toEqual({ page: 4, hasNext: false });
    expect(readGlobalCollectionPageLabel('Chargement…')).toBeUndefined();
  });
});

/** Composant à états imité : ses hooks d'état, dans l'ordre (valeur, appels reçus). */
function component(...values: unknown[]) {
  const calls: unknown[][] = values.map(() => []);
  const memoizedState = values.reduceRight<unknown>(
    (next, value, i) => ({ memoizedState: value, queue: { dispatch: (state: unknown) => calls[i]?.push(state) }, next }),
    null,
  );
  const fiber: Fiber = { memoizedProps: {}, return: null, memoizedState };
  return { fiber, calls };
}

const host = (): Fiber => ({ memoizedProps: {}, return: null });

describe('globalCollectionStatesAmong', () => {
  // Page du catalogue (code du site) : …, champ de recherche, tri, raretés, page, carte ouverte, recherche en cours.
  const page = () => component([], 1200, false, {}, false, null, false, 'name', 'rarity', new Set(['L']), 2, null, 'name');

  it('tri reconnu à sa valeur, suivi des raretés et de la page', () => {
    const catalog = page();
    const states = globalCollectionStatesAmong([host(), host(), catalog.fiber], 'rarity');
    expect(states?.page.value).toBe(2);
    states?.page.set(5);
    states?.rarities.set(new Set());
    expect(catalog.calls[10]).toEqual([5]);
    expect(catalog.calls[9]).toEqual([new Set()]);
  });

  it('tri introuvable ou ambigu : rien', () => {
    expect(globalCollectionStatesAmong([page().fiber], 'atk')).toBeUndefined();
    expect(globalCollectionStatesAmong([component('rarity', new Set(), 0, 'rarity', new Set(), 1).fiber], 'rarity')).toBeUndefined();
  });
});
