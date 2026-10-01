import { describe, expect, it } from 'vitest';
import {
  isProfileCollectionList,
  profileCollectionStatesAmong,
  readProfileCollectionQuery,
  sameProfileCollectionChoice,
} from '@/site/profile/collection';
import { netRequest, stateComponent, statelessFiber } from '../../support';

const url = (path: string) => new URL(`https://www.wiki-masters.com${path}`);
const list = (search: string) => url(`/api/profile/aelonka/collection?${search}`);

describe('isProfileCollectionList', () => {
  const page = '/profile/aelonka';

  it('collection du joueur dont le profil est affiché, pseudo encodé compris', () => {
    expect(isProfileCollectionList(netRequest(list('page=0&sort=rarity&pending=1')), page)).toBe(true);
    const jean = url('/api/profile/Jean%20Pierre%20%F0%9F%90%B1/collection?page=0');
    expect(isProfileCollectionList(netRequest(jean), '/profile/Jean%20Pierre%20%F0%9F%90%B1')).toBe(true);
    expect(isProfileCollectionList(netRequest(url('/api/profile/aelonka/showcase')), page)).toBe(false);
    expect(isProfileCollectionList(netRequest(url('/api/my-collection?page=0')), page)).toBe(false);
    expect(isProfileCollectionList(netRequest(list('page=0'), { method: 'POST' }), page)).toBe(false);
  });

  it('pas la collection d’un autre joueur (fenêtre d’échange), ni hors d’un profil', () => {
    expect(isProfileCollectionList(netRequest(url('/api/profile/bob/collection?page=0&pending=1')), page)).toBe(false);
    expect(isProfileCollectionList(netRequest(list('page=0&pending=1')), '/trades')).toBe(false);
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

describe('profileCollectionStatesAmong', () => {
  // Onglet (code du site) : exemplaires, total, étiquettes, en échange, chargement, champ, recherche en cours,
  // tri, raretés, étiquette, page, exemplaire ouvert, erreur.
  const tab = (tag: unknown = null) => stateComponent({}, [], 89, [], new Set(), false, 'name', 'name', 'rarity', new Set(['L']), tag, 2, null, null);

  it('tri reconnu à sa valeur, suivi des raretés, de l’étiquette et de la page', () => {
    for (const tag of [null, 't1']) {
      const page = tab(tag);
      const states = profileCollectionStatesAmong([statelessFiber(), statelessFiber(), page.fiber], 'rarity');
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
    const twice = stateComponent({}, 'rarity', new Set(), null, 0, 'rarity', new Set(), null, 1);
    expect(profileCollectionStatesAmong([twice.fiber], 'rarity')).toBeUndefined();
  });
});
