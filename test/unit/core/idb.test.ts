import { afterEach, describe, expect, it, vi } from 'vitest';
import { idbStore } from '@/core/idb';

const TEST_DB = { name: 'test', version: 1, stores: ['items'] };

// Pas d'IndexedDB dans Node : c'est le repli en mémoire qui est vérifié ici (IndexedDB : tests navigateur).
describe('magasin IndexedDB sans IndexedDB', () => {
  it('garde les valeurs en mémoire pour la session, sans lever', async () => {
    const store = idbStore({ database: TEST_DB, store: 'items' });
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

/** IndexedDB imité qui s'ouvre, mais dont chaque requête échoue (base corrompue, quota…). */
function failingIndexedDb() {
  const failing = () => {
    const request: { onsuccess?: () => void; onerror?: () => void } = {};
    setTimeout(() => request.onerror?.(), 0);
    return request;
  };
  const objects = { get: failing, getAll: failing, put: failing, delete: failing, clear: failing };
  const db = { transaction: () => ({ objectStore: () => objects }), close: () => {} };
  return {
    opened: 0,
    open() {
      this.opened++;
      const request: { result: unknown; onsuccess?: () => void } = { result: db };
      setTimeout(() => request.onsuccess?.(), 0);
      return request;
    },
  };
}

describe('magasin IndexedDB en échec', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('une requête en échec rend la copie en mémoire ; la base n’est ouverte qu’une fois', async () => {
    const indexedDB = failingIndexedDb();
    vi.stubGlobal('indexedDB', indexedDB);
    const store = idbStore({ database: TEST_DB, store: 'items' });
    await store.put({ id: 'a', value: 1 });
    expect(await store.get('a')).toEqual({ id: 'a', value: 1 });
    expect(await store.values()).toEqual([{ id: 'a', value: 1 }]);
    expect(await store.get('b')).toBeUndefined();
    expect(indexedDB.opened).toBe(1);
  });
});
