import { describe, expect, it } from 'vitest';
import { isCollectionList, isCollectionStats, parseCollection } from '@/site/collection/collection';
import { netRequest } from '../../support';

describe('requêtes de la page Collection', () => {
  it('liste et compteurs de la page, pas ceux de la fenêtre d’échange (`owned_by`)', () => {
    expect(isCollectionList(netRequest('/api/my-collection?sort=rarity&page=0&stats=0'))).toBe(true);
    expect(isCollectionList(netRequest('/api/my-collection?sort=rarity&page=0&stats=0&owned_by=aelonka'))).toBe(false);
    expect(isCollectionList(netRequest('/api/my-collection/stats?sort=rarity'))).toBe(false);
    expect(isCollectionStats(netRequest('/api/my-collection/stats?sort=rarity'))).toBe(true);
    expect(isCollectionStats(netRequest('/api/my-collection/stats?sort=rarity&owned_by=aelonka'))).toBe(false);
    expect(isCollectionStats(netRequest('/api/my-collection/stats', { method: 'POST' }))).toBe(false);
  });
});

describe('parseCollection', () => {
  it('exemplaires de la liste : id, titre de la carte, nombre possédé (1 par défaut)', () => {
    const body = {
      collection: [
        { id: 'u1', count: 3, card: { id: 'c1', wikipedia_title: 'Tour Eiffel' } },
        { id: 'u2', card: null },
      ],
      total: 2,
    };
    expect(parseCollection(body)).toEqual([
      { id: 'u1', title: 'Tour Eiffel', count: 3 },
      { id: 'u2', title: '', count: 1 },
    ]);
  });

  it('une ligne sans id rend toute la liste illisible', () => {
    expect(parseCollection({ collection: [{ id: 'u1' }, { card: {} }] })).toBeUndefined();
    expect(parseCollection({ error: 'x' })).toBeUndefined();
  });
});
