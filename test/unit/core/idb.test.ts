import { describe, expect, it } from 'vitest';
import { idbStore } from '@/core/idb';

// Pas d'IndexedDB dans Node : c'est le repli en mémoire qui est vérifié ici (IndexedDB : tests Edge).
describe('magasin IndexedDB sans IndexedDB', () => {
  it('garde les valeurs en mémoire pour la session, sans lever', async () => {
    const store = idbStore({ database: 'test', version: 1, store: 'items' });
    expect(await store.get('a')).toBeUndefined();
    await store.put({ id: 'a', value: 1 });
    await store.put({ id: 'b', value: 2 });
    await store.put({ id: 'a', value: 3 });
    expect(await store.get('a')).toEqual({ id: 'a', value: 3 });
    expect(await store.values()).toHaveLength(2);
    await store.delete('b');
    expect(await store.values()).toEqual([{ id: 'a', value: 3 }]);
    await store.clear();
    expect(await store.values()).toEqual([]);
  });
});
