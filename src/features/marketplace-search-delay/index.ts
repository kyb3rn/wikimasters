import type { Feature } from '@/core/runtime';
import { submitAfterTyping, trackListDelay } from '@/services/list-search';
import { findMarketplaceFilters, isMarketplaceAppend, MARKETPLACE_ROUTE, marketplaceList } from '@/site/marketplace';

/**
 * Comme la Collection : la recherche part d'elle-même après la frappe (le site attend Entrée ou son bouton,
 * caché), et un changement de filtre que la recherche ne retient pas ne charge qu'après un court délai sans
 * autre changement.
 */
export const marketplaceSearchDelay: Feature = {
  id: 'marketplace-search-delay',
  name: 'Recherche',
  description: 'La recherche part d’elle-même après la frappe, et les filtres ne chargent la liste qu’une fois les changements finis.',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  required: true,
  hidden: true,
  mount(ctx) {
    const { signal, log } = ctx;
    trackListDelay({ source: marketplaceList, signal, log, appends: isMarketplaceAppend });
    submitAfterTyping({
      signal,
      field: () => findMarketplaceFilters()?.field,
      submit: () => findMarketplaceFilters()?.submit,
    });
  },
};
