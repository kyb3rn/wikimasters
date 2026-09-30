import { createLogger } from './log';

const log = createLogger('stockage');

/**
 * Un magasin d'objets IndexedDB (clé `id`), dans le profil du navigateur, par site. Lecture et écriture ne
 * lèvent jamais : IndexedDB indisponible (navigation privée, base bloquée), le magasin retombe sur une copie
 * en mémoire pour la session. Les valeurs relues sont à valider par l'appelant.
 */
export interface IdbStore {
  get(id: string): Promise<unknown>;
  put<T extends { readonly id: string }>(value: T): Promise<void>;
  delete(id: string): Promise<void>;
  values(): Promise<unknown[]>;
  clear(): Promise<void>;
}

export interface IdbStoreOptions {
  readonly database: string;
  readonly version: number;
  readonly store: string;
}

/** Base bloquée par un autre onglet (ancienne version encore ouverte) : repli mémoire au bout de ce délai. */
const BLOCKED_MS = 2000;

export function idbStore(options: IdbStoreOptions): IdbStore {
  const { database, version, store } = options;
  // Toujours tenue à jour : lue quand la base manque.
  const memory = new Map<string, unknown>();
  let opening: Promise<IDBDatabase | undefined> | undefined;

  function open(): Promise<IDBDatabase | undefined> {
    if (opening) return opening;
    const current = new Promise<IDBDatabase | undefined>((resolve) => {
      let settled = false;
      const done = (db: IDBDatabase | undefined) => {
        if (settled) return;
        settled = true;
        resolve(db);
      };
      try {
        const request = indexedDB.open(database, version);
        request.onupgradeneeded = () => {
          if (!request.result.objectStoreNames.contains(store)) request.result.createObjectStore(store, { keyPath: 'id' });
        };
        request.onsuccess = () => {
          const db = request.result;
          // Ouverte après le repli mémoire : relâchée, la prochaine opération rouvrira.
          if (settled) {
            db.close();
            return;
          }
          // Un autre onglet met la base à niveau : on la lui laisse.
          db.onversionchange = () => {
            db.close();
            if (opening === current) opening = undefined;
          };
          done(db);
        };
        request.onerror = () => done(undefined);
        request.onblocked = () => {
          log.warn(`base ${database} bloquée par un autre onglet du site (à recharger)`);
          setTimeout(() => {
            if (settled) return;
            done(undefined);
            if (opening === current) opening = undefined;
          }, BLOCKED_MS);
        };
      } catch {
        done(undefined);
      }
    });
    opening = current;
    return current;
  }

  async function run<T>(mode: IDBTransactionMode, action: (objects: IDBObjectStore) => IDBRequest, fallback: T): Promise<T> {
    const db = await open();
    if (!db) return fallback;
    return new Promise<T>((resolve) => {
      try {
        const request = action(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => resolve(fallback);
      } catch {
        resolve(fallback);
      }
    });
  }

  return {
    async get(id) {
      const db = await open();
      if (!db) return memory.get(id);
      return run<unknown>('readonly', (objects) => objects.get(id), undefined);
    },
    async put(value) {
      memory.set(value.id, value);
      await run('readwrite', (objects) => objects.put(value), undefined);
    },
    async delete(id) {
      memory.delete(id);
      await run('readwrite', (objects) => objects.delete(id), undefined);
    },
    async values() {
      const db = await open();
      if (!db) return [...memory.values()];
      return run<unknown[]>('readonly', (objects) => objects.getAll(), []);
    },
    async clear() {
      memory.clear();
      await run('readwrite', (objects) => objects.clear(), undefined);
    },
  };
}
