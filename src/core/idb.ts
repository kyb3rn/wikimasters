import { createLogger } from './log';

const log = createLogger('stockage');

/**
 * Un magasin d'objets IndexedDB (clé `id`), dans le profil du navigateur, par site. Lecture et écriture ne
 * lèvent jamais : IndexedDB indisponible (navigation privée, base bloquée), le magasin retombe sur une copie
 * en mémoire pour la session. Les valeurs relues sont à valider par l'appelant.
 */
export interface IdbStore {
  get(id: string): Promise<unknown>;
  /** Plusieurs d'un coup, dans l'ordre de `ids` (`undefined` : absent), en une transaction. */
  getMany(ids: readonly string[]): Promise<unknown[]>;
  put<T extends { readonly id: string }>(value: T): Promise<void>;
  /** Plusieurs d'un coup, en une transaction. */
  putMany<T extends { readonly id: string }>(values: readonly T[]): Promise<void>;
  delete(id: string): Promise<void>;
  /** Plusieurs d'un coup, en une transaction. */
  deleteMany(ids: readonly string[]): Promise<void>;
  values(): Promise<unknown[]>;
  clear(): Promise<void>;
}

/** Une base et tous ses magasins : la mise à niveau crée ceux qui manquent (un par `idbStore`, même base, même version). */
export interface IdbDatabase {
  readonly name: string;
  readonly version: number;
  readonly stores: readonly string[];
}

export interface IdbStoreOptions {
  readonly database: IdbDatabase;
  /** Un des magasins de la base. */
  readonly store: string;
}

/** Base bloquée par un autre onglet (ancienne version encore ouverte) : repli mémoire au bout de ce délai. */
const BLOCKED_MS = 2000;

export function idbStore(options: IdbStoreOptions): IdbStore {
  const { database, store } = options;
  const { name, version, stores } = database;
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
        const request = indexedDB.open(name, version);
        request.onupgradeneeded = () => {
          for (const wanted of stores) {
            if (!request.result.objectStoreNames.contains(wanted)) request.result.createObjectStore(wanted, { keyPath: 'id' });
          }
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
          log.warn(`base ${name} bloquée par un autre onglet du site (à recharger)`);
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

  /** Base indisponible ou requête en échec : `fallback`, lu à ce moment-là dans la copie en mémoire. */
  async function run<T>(mode: IDBTransactionMode, action: (objects: IDBObjectStore) => IDBRequest, fallback: () => T): Promise<T> {
    const db = await open();
    if (!db) return fallback();
    return new Promise<T>((resolve) => {
      try {
        const request = action(db.transaction(store, mode).objectStore(store));
        request.onsuccess = () => resolve(request.result as T);
        request.onerror = () => resolve(fallback());
      } catch {
        resolve(fallback());
      }
    });
  }

  const nothing = () => undefined;

  /** Une transaction d'écriture pour toute la série ; base indisponible : la copie en mémoire seule. */
  async function writeMany(action: (objects: IDBObjectStore) => void): Promise<void> {
    const db = await open();
    if (!db) return;
    await new Promise<void>((resolve) => {
      try {
        const transaction = db.transaction(store, 'readwrite');
        action(transaction.objectStore(store));
        transaction.oncomplete = () => resolve();
        transaction.onerror = () => resolve();
        transaction.onabort = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  return {
    get: (id) => run<unknown>('readonly', (objects) => objects.get(id), () => memory.get(id)),
    async getMany(ids) {
      const fromMemory = () => ids.map((id) => memory.get(id));
      const db = ids.length > 0 ? await open() : undefined;
      if (!db) return fromMemory();
      return new Promise<unknown[]>((resolve) => {
        try {
          const transaction = db.transaction(store, 'readonly');
          const objects = transaction.objectStore(store);
          const results: unknown[] = [];
          ids.forEach((id, index) => {
            const request = objects.get(id);
            request.onsuccess = () => {
              results[index] = request.result as unknown;
            };
          });
          transaction.oncomplete = () => resolve(ids.map((_, index) => results[index]));
          transaction.onerror = () => resolve(fromMemory());
          transaction.onabort = () => resolve(fromMemory());
        } catch {
          resolve(fromMemory());
        }
      });
    },
    async put(value) {
      memory.set(value.id, value);
      await run('readwrite', (objects) => objects.put(value), nothing);
    },
    async putMany(values) {
      if (values.length === 0) return;
      for (const value of values) memory.set(value.id, value);
      await writeMany((objects) => {
        for (const value of values) objects.put(value);
      });
    },
    async delete(id) {
      memory.delete(id);
      await run('readwrite', (objects) => objects.delete(id), nothing);
    },
    async deleteMany(ids) {
      if (ids.length === 0) return;
      for (const id of ids) memory.delete(id);
      await writeMany((objects) => {
        for (const id of ids) objects.delete(id);
      });
    },
    values: () => run<unknown[]>('readonly', (objects) => objects.getAll(), () => [...memory.values()]),
    async clear() {
      memory.clear();
      await run('readwrite', (objects) => objects.clear(), nothing);
    },
  };
}
