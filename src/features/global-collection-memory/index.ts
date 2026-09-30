import { waitUntil } from '@/core/async';
import { isRecord } from '@/core/guards';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { jsonStore } from '@/core/storage';
import { trackListMemory, type ApplyResult, type Saved } from '@/services/list-search';
import {
  findGlobalCollectionFilters,
  forgetGlobalCollectionPages,
  GLOBAL_COLLECTION_ROUTE,
  globalCollectionList,
  isGlobalCollectionLoading,
  withGlobalCollectionFilters,
  type GlobalCollectionQuery,
} from '@/site/global-collection';
import { findListbox } from '@/site/listbox';

type SavedFilters = Saved<GlobalCollectionQuery>;

export function parseSavedFilters(raw: unknown): SavedFilters | undefined {
  if (!isRecord(raw)) return undefined;
  const { sort, search, rarities, wishlist } = raw;
  if (typeof sort !== 'string' || !sort || typeof search !== 'string' || typeof rarities !== 'string' || typeof wishlist !== 'boolean') {
    return undefined;
  }
  return { sort, search, rarities, wishlist };
}

const savedFilters = jsonStore<SavedFilters | undefined>('wm-global-collection-filters-v1', undefined, parseSavedFilters);

/** Délai pour que « Rechercher » du site prenne le texte remis dans le champ. */
const SUBMIT_TIMEOUT = 2000;

/** Remet les contrôles du site aux filtres retenus (tri, raretés, liste de souhaits, puis la recherche). */
function applyFilters(target: GlobalCollectionQuery, signal: AbortSignal): ApplyResult {
  const filters = findGlobalCollectionFilters();
  const sort = filters && findListbox(filters.sort);
  if (!filters || !sort) return 'unavailable';
  let changed = false;
  if (sort.value !== target.sort && sort.options.some((option) => option.value === target.sort)) {
    sort.onChange(target.sort);
    changed = true;
  }
  const rarities = new Set(target.rarities ? target.rarities.split(',') : []);
  for (const pill of filters.pills.pills) {
    if (pill.checked === rarities.has(pill.rarity)) continue;
    pill.button.click();
    changed = true;
  }
  if (filters.wishlist && filters.wishlist.active !== target.wishlist) {
    filters.wishlist.button.click();
    changed = true;
  }
  if (filters.field.value.trim() !== target.search) {
    setReactInputValue(filters.field, target.search);
    changed = true;
    // « Rechercher » ne s'active qu'une fois le texte pris par la page.
    const submit = () => findGlobalCollectionFilters()?.submit;
    void waitUntil(() => submit()?.disabled === false, { signal, timeoutMs: SUBMIT_TIMEOUT }).then((ready) => {
      if (ready) submit()?.click();
    });
  }
  return changed ? 'applied' : 'unchanged';
}

/**
 * Comme la Collection : retient les filtres de la dernière liste chargée (tri, raretés, liste de souhaits,
 * recherche) et y revient à l'arrivée, en page 1.
 */
export const globalCollectionMemory: Feature = {
  id: 'global-collection-memory',
  name: 'Filtres retenus',
  description: "À l'arrivée sur le catalogue, la liste revient aux filtres de la dernière recherche.",
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  mount(ctx) {
    const { signal, log } = ctx;
    trackListMemory({
      source: globalCollectionList,
      signal,
      log,
      store: savedFilters,
      withFilters: withGlobalCollectionFilters,
      ready: () => {
        const filters = findGlobalCollectionFilters();
        return filters !== undefined && !isGlobalCollectionLoading(filters);
      },
      apply: applyFilters,
      // Le site garderait la réponse servie sous l'adresse de sa requête (d'autres filtres).
      onMismatch: () => {
        for (const delay of [0, 500]) {
          window.setTimeout(() => {
            if (!signal.aborted) forgetGlobalCollectionPages();
          }, delay);
        }
      },
    });
  },
};
