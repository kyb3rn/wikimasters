import type { Feature } from '@/core/runtime';
import {
  applyRarities,
  applySearch,
  savedFiltersStore,
  savedListStore,
  trackListMemory,
  type ApplyResult,
  type SavedShape,
} from '@/services/list-search';
import {
  findGlobalCollectionFilters,
  forgetGlobalCollectionPagesSoon,
  globalCollectionList,
  isGlobalCollectionLoading,
  withGlobalCollectionFilters,
  type GlobalCollectionQuery,
} from '@/site/global-collection';
import { findListbox } from '@/site/listbox';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';

const SHAPE: SavedShape<GlobalCollectionQuery> = { sort: 'text', search: 'string', rarities: 'string', wishlist: 'boolean' };
const savedFilters = savedFiltersStore('wm-global-collection-filters-v1', SHAPE);
const savedList = savedListStore('wm-global-collection-list-v1', SHAPE);

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
  if (applyRarities(filters.pills, target.rarities)) changed = true;
  if (filters.wishlist && filters.wishlist.active !== target.wishlist) {
    filters.wishlist.button.click();
    changed = true;
  }
  if (applySearch(filters.field, target.search, () => findGlobalCollectionFilters()?.submit, signal)) changed = true;
  return changed ? 'applied' : 'unchanged';
}

/**
 * Comme la Collection : retient les filtres de la dernière liste chargée (tri, raretés, liste de souhaits,
 * recherche) et y revient à l'arrivée, en page 1. Demande de l'utilisateur : la première page de cette liste est
 * gardée elle aussi et réaffichée aussitôt, sans requête ; elle reste telle quelle jusqu'au prochain chargement.
 */
export const globalCollectionMemory: Feature = {
  id: 'global-collection-memory',
  name: 'Filtres retenus',
  description: "À l'arrivée sur le catalogue, la dernière recherche revient aussitôt, filtres et résultats.",
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
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
      onMismatch: () => forgetGlobalCollectionPagesSoon(signal),
      savedList: { store: savedList, firstPage: 0 },
    });
  },
};
