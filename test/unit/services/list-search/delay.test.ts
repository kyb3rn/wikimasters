import { describe, expect, it } from 'vitest';
import { listWait, SEARCH_DELAY } from '@/services/list-search';
import { profileCollectionList, readProfileCollectionQuery } from '@/site/profile';

const query = (search: string) => readProfileCollectionQuery(new URL(`https://www.wiki-masters.com/api/profile/a/collection?${search}`));

describe('listWait', () => {
  const shown = query('page=0&sort=rarity');

  it('première requête, autre page, actualisation : aussitôt', () => {
    expect(listWait(profileCollectionList, shown, undefined, 300)).toBe(0);
    expect(listWait(profileCollectionList, query('page=2&sort=rarity'), shown, 300)).toBe(0);
    expect(listWait(profileCollectionList, shown, shown, 300)).toBe(0);
  });

  it('autre choix : tout le délai', () => {
    expect(listWait(profileCollectionList, query('page=0&sort=added'), shown, 300)).toBe(SEARCH_DELAY);
    expect(listWait(profileCollectionList, query('page=0&sort=rarity&rarity=L'), shown, undefined)).toBe(SEARCH_DELAY);
  });

  it('autre recherche : le reste du délai si la page a déjà attendu après la frappe, sinon aussitôt', () => {
    expect(listWait(profileCollectionList, query('page=0&sort=rarity&q=spo'), shown, 300)).toBe(SEARCH_DELAY - 300);
    expect(listWait(profileCollectionList, query('page=0&sort=rarity&q=spo'), shown, undefined)).toBe(0);
  });
});
