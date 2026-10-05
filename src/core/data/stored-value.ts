import type { JsonStore } from '@/core/storage';
import type { DataSet } from './types';

/** Ce qu'une valeur gardée montre dans sa ligne. */
export interface StoredValueView {
  readonly details: readonly string[];
  readonly date?: number;
}

export interface StoredValueOptions<T> {
  readonly id: string;
  readonly name: string;
  readonly tab: string;
  readonly description: string;
  /** Sa clé du localStorage. */
  readonly key: string;
  readonly store: JsonStore<T>;
  /** Ce que la ligne en dit ; `undefined` : rien de retenu (valeur de repli). */
  readonly describe: (value: T) => StoredValueView | undefined;
}

/** Une valeur unique du localStorage (filtres retenus, dernier onglet…) : une ligne, « Oublier » l'efface. */
export function storedValueData<T>(options: StoredValueOptions<T>): DataSet {
  const { id, name, tab, description, key, store, describe } = options;
  return {
    id,
    name,
    tab,
    description,
    storage: [key],
    single: true,
    list() {
      const bytes = store.bytes();
      const view = bytes > 0 ? describe(store.get()) : undefined;
      return Promise.resolve(view ? [{ key, title: name, details: view.details, date: view.date, bytes }] : []);
    },
    remove() {
      store.remove();
      return Promise.resolve();
    },
    clear() {
      store.remove();
      return Promise.resolve();
    },
  };
}
