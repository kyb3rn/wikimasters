import { isRecord } from '@/core/guards';
import { jsonStore } from '@/core/storage';
import type { CollectionQuery } from '@/site/collection';

/** Filtres de la dernière liste chargée (sans la page : on revient en page 1). */
export type SavedFilters = Omit<CollectionQuery, 'page'>;

export function parseSavedFilters(raw: unknown): SavedFilters | undefined {
  if (!isRecord(raw)) return undefined;
  const { sort, tag, search, rarities } = raw;
  if (typeof sort !== 'string' || !sort || typeof tag !== 'string' || typeof search !== 'string' || typeof rarities !== 'string') {
    return undefined;
  }
  return { sort, tag, search, rarities };
}

export const savedFilters = jsonStore<SavedFilters | undefined>('wm-collection-filters-v1', undefined, parseSavedFilters);

export function toSaved({ sort, tag, search, rarities }: CollectionQuery): SavedFilters {
  return { sort, tag, search, rarities };
}
