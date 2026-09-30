import { describe, expect, it } from 'vitest';
import type { NetRequest } from '@/core/net';
import type { Fiber } from '@/core/react';
import {
  isProfileCollectionList,
  profileCollectionStatesAmong,
  readProfileCollectionPageLabel,
  readProfileCollectionQuery,
  sameProfileCollectionChoice,
} from '@/site/profile';

const url = (path: string) => new URL(`https://www.wiki-masters.com${path}`);
const list = (search: string) => url(`/api/profile/aelonka/collection?${search}`);
const request = (href: URL, method = 'GET') => ({ method, url: href }) as NetRequest;

describe('isProfileCollectionList', () => {
  it('collection d’un joueur seulement, pseudo encodé compris', () => {
    expect(isProfileCollectionList(request(list('page=0&sort=rarity')))).toBe(true);
    expect(isProfileCollectionList(request(url('/api/profile/Jean%20Pierre%20%F0%9F%90%B1/collection?page=0')))).toBe(true);
    expect(isProfileCollectionList(request(url('/api/profile/aelonka/showcase')))).toBe(false);
    expect(isProfileCollectionList(request(url('/api/my-collection?page=0')))).toBe(false);
    expect(isProfileCollectionList(request(list('page=0'), 'POST'))).toBe(false);
  });
});

describe('readProfileCollectionQuery', () => {
  it('lit tri, étiquette, recherche, raretés (triées) et page', () => {
    expect(readProfileCollectionQuery(list('page=2&sort=name&stats=0&q=spo&rarity=UR&rarity=C&tag_id=t1&pending=1'))).toEqual({
      sort: 'name',
      tag: 't1',
      search: 'spo',
      rarities: 'C,UR',
      page: 2,
    });
    expect(readProfileCollectionQuery(list('page=0&sort=rarity&stats=1&pending=1'))).toEqual({
      sort: 'rarity',
      tag: '',
      search: '',
      rarities: '',
      page: 0,
    });
  });

  it('mêmes choix : la recherche et la page n’en sont pas', () => {
    const a = readProfileCollectionQuery(list('page=0&sort=rarity&stats=1&q=spo&pending=1'));
    expect(sameProfileCollectionChoice(a, readProfileCollectionQuery(list('page=3&sort=rarity&stats=0&pending=1')))).toBe(true);
    expect(sameProfileCollectionChoice(a, readProfileCollectionQuery(list('page=0&sort=added&stats=1&pending=1')))).toBe(false);
    expect(sameProfileCollectionChoice(a, readProfileCollectionQuery(list('page=0&sort=rarity&stats=1&tag_id=t1&pending=1')))).toBe(false);
    expect(sameProfileCollectionChoice(a, readProfileCollectionQuery(list('page=0&sort=rarity&stats=1&rarity=L&pending=1')))).toBe(false);
  });
});

describe('readProfileCollectionPageLabel', () => {
  it('« Page x / y », rien d’autre', () => {
    expect(readProfileCollectionPageLabel('Page 3 / 12')).toEqual({ page: 3, total: 12 });
    expect(readProfileCollectionPageLabel('Chargement…')).toBeUndefined();
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

describe('profileCollectionStatesAmong', () => {
  // Onglet (code du site) : exemplaires, total, étiquettes, en échange, chargement, champ, recherche en cours,
  // tri, raretés, étiquette, page, exemplaire ouvert, erreur.
  const tab = (tag: unknown = null) => component([], 89, [], new Set(), false, 'name', 'name', 'rarity', new Set(['L']), tag, 2, null, null);

  it('tri reconnu à sa valeur, suivi des raretés, de l’étiquette et de la page', () => {
    for (const tag of [null, 't1']) {
      const page = tab(tag);
      const states = profileCollectionStatesAmong([host(), host(), page.fiber], 'rarity');
      expect(states?.page.value).toBe(2);
      states?.page.set(5);
      states?.rarities.set(new Set());
      expect(page.calls[10]).toEqual([5]);
      expect(page.calls[8]).toEqual([new Set()]);
    }
  });

  it('tri introuvable, forme inattendue ou ambiguë : rien', () => {
    expect(profileCollectionStatesAmong([tab().fiber], 'added')).toBeUndefined();
    expect(profileCollectionStatesAmong([tab(0).fiber], 'rarity')).toBeUndefined();
    const twice = component('rarity', new Set(), null, 0, 'rarity', new Set(), null, 1);
    expect(profileCollectionStatesAmong([twice.fiber], 'rarity')).toBeUndefined();
  });
});
