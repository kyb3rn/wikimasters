import type { Feature } from '@/core/runtime';
import { applyRarities, applySearch, savedFiltersStore, trackListMemory, type ApplyResult } from '@/services/list-search';
import { chooseSelectValue } from '@/site/listbox';
import { findMarketplaceFilters, isMarketplaceMineRefresh, marketplaceList, withMarketplaceFilters, type MarketplaceQuery } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';

const savedFilters = savedFiltersStore<MarketplaceQuery>('wm-marketplace-filters-v1', { sort: 'text', search: 'string', rarities: 'string' });

/** Remet les contrôles du site aux filtres retenus (tri, raretés, puis la recherche). */
function applyFilters(target: MarketplaceQuery, signal: AbortSignal): ApplyResult {
  const filters = findMarketplaceFilters();
  if (!filters) return 'unavailable';
  let changed = false;
  if (filters.sort.value !== target.sort && [...filters.sort.options].some((option) => option.value === target.sort)) {
    chooseSelectValue(filters.sort, target.sort);
    changed = true;
  }
  if (applyRarities(filters.pills, target.rarities)) changed = true;
  if (applySearch(filters.field, target.search, () => findMarketplaceFilters()?.submit, signal)) changed = true;
  return changed ? 'applied' : 'unchanged';
}

/**
 * Comme la Collection : retient les filtres de la dernière liste chargée (tri, raretés, recherche) et y revient
 * à l'arrivée sur le marché. Au retour d'une annonce, le site remet lui-même ses filtres et sa liste : on n'y
 * touche pas.
 */
export const marketplaceMemory: Feature = {
  id: 'marketplace-memory',
  name: 'Filtres retenus',
  description: "À l'arrivée sur le marché, la liste revient aux filtres de la dernière recherche.",
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    trackListMemory({
      source: marketplaceList,
      signal,
      log,
      store: savedFilters,
      withFilters: withMarketplaceFilters,
      ready: () => findMarketplaceFilters() !== undefined,
      apply: applyFilters,
      siteRestore: isMarketplaceMineRefresh,
    });
  },
};
