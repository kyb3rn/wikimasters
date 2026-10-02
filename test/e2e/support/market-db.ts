import type { Page } from '@playwright/test';

/** Base `wm-market` du script (`MARKET_DATABASE`) : même version et mêmes magasins, sinon l'ouverture échoue. */
const DATABASE = { name: 'wm-market', version: 3, stores: ['sales', 'listings'] } as const;

export type MarketStore = (typeof DATABASE.stores)[number];

/** Écrit des enregistrements (`{ id, … }`) dans un magasin de la base, depuis la page. */
export async function putMarketRecords(page: Page, store: MarketStore, records: readonly object[]): Promise<void> {
  await page.evaluate(
    ([database, name, values]) =>
      new Promise<void>((resolve, reject) => {
        const open = indexedDB.open(database.name, database.version);
        open.onupgradeneeded = () => {
          for (const wanted of database.stores) {
            if (!open.result.objectStoreNames.contains(wanted)) open.result.createObjectStore(wanted, { keyPath: 'id' });
          }
        };
        open.onerror = () => reject(open.error ?? new Error('IndexedDB indisponible'));
        open.onsuccess = () => {
          const transaction = open.result.transaction(name, 'readwrite');
          for (const value of values) transaction.objectStore(name).put(value);
          transaction.oncomplete = () => {
            open.result.close();
            resolve();
          };
        };
      }),
    [DATABASE, store, records] as const,
  );
}

/** Tous les enregistrements d'un magasin de la base, lus depuis la page. */
export async function readMarketRecords(page: Page, store: MarketStore): Promise<unknown[]> {
  return page.evaluate(
    ([database, name]) =>
      new Promise<unknown[]>((resolve, reject) => {
        const open = indexedDB.open(database.name, database.version);
        open.onupgradeneeded = () => {
          for (const wanted of database.stores) {
            if (!open.result.objectStoreNames.contains(wanted)) open.result.createObjectStore(wanted, { keyPath: 'id' });
          }
        };
        open.onerror = () => reject(open.error ?? new Error('IndexedDB indisponible'));
        open.onsuccess = () => {
          const request = open.result.transaction(name, 'readonly').objectStore(name).getAll();
          request.onsuccess = () => {
            open.result.close();
            resolve(request.result as unknown[]);
          };
          request.onerror = () => reject(request.error ?? new Error('lecture impossible'));
        };
      }),
    [DATABASE, store] as const,
  );
}
