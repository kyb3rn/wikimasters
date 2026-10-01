import { describe, expect, it } from 'vitest';
import { listWait } from '@/services/list-search/delay';
import { SEARCH_DELAY } from '@/services/list-search/types';
import { collectionList } from '@/site/collection';
import { globalCollectionList } from '@/site/global-collection';
import { profileCollectionList } from '@/site/profile';
import { SITE_TYPING_DELAY } from '@/site/list-query';

const friend = (search: string) => profileCollectionList.readQuery(new URL(`https://www.wiki-masters.com/api/profile/a/collection?${search}`));
const mine = (search: string) => collectionList.readQuery(new URL(`https://www.wiki-masters.com/api/my-collection${search}`));
const catalog = (search: string) => globalCollectionList.readQuery(new URL(`https://www.wiki-masters.com/api/cards?${search}`));

describe('listWait', () => {
  const shown = friend('page=0&sort=rarity');

  it('première requête, autre page, actualisation : aussitôt', () => {
    expect(listWait(profileCollectionList, shown, undefined)).toBe(0);
    expect(listWait(profileCollectionList, friend('page=2&sort=rarity'), shown)).toBe(0);
    expect(listWait(profileCollectionList, shown, shown)).toBe(0);
    // Compteurs de la Collection (sans page) : de même.
    expect(listWait(collectionList, mine('?sort=rarity&rarity=R'), mine('?sort=rarity&rarity=R'))).toBe(0);
  });

  it('autre choix : tout le délai', () => {
    expect(listWait(profileCollectionList, friend('page=0&sort=added'), shown)).toBe(SEARCH_DELAY);
    expect(listWait(profileCollectionList, friend('page=0&sort=rarity&rarity=L'), shown)).toBe(SEARCH_DELAY);
    expect(listWait(collectionList, mine('?sort=rarity&tag_id=t1'), mine('?sort=rarity'))).toBe(SEARCH_DELAY);
    expect(listWait(globalCollectionList, catalog('page=0&sort=rarity&wishlist=1'), catalog('page=3&sort=rarity'))).toBe(SEARCH_DELAY);
  });

  it('autre recherche : le reste du délai si la page a déjà attendu après la frappe, sinon aussitôt', () => {
    expect(listWait(profileCollectionList, friend('page=0&sort=rarity&q=spo'), shown)).toBe(SEARCH_DELAY - SITE_TYPING_DELAY);
    expect(listWait(collectionList, mine('?sort=rarity&q=tour'), mine('?sort=rarity'))).toBe(SEARCH_DELAY - SITE_TYPING_DELAY);
    // Toutes les cartes ne cherche qu'à Entrée ou par son bouton : la frappe a déjà été attendue (ou lancée).
    expect(listWait(globalCollectionList, catalog('page=0&sort=rarity&q=tour'), catalog('page=0&sort=rarity'))).toBe(0);
  });
});
