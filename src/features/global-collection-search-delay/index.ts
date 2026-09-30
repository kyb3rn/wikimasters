import type { Feature } from '@/core/runtime';
import { submitAfterTyping, trackListDelay } from '@/services/list-search';
import { findGlobalCollectionFilters, GLOBAL_COLLECTION_ROUTE, globalCollectionList } from '@/site/global-collection';

/**
 * Comme la Collection : la recherche part d'elle-même après la frappe (le site attend Entrée ou son bouton,
 * caché), et un changement de filtre que la recherche ne retient pas ne charge qu'après un court délai sans
 * autre changement.
 */
export const globalCollectionSearchDelay: Feature = {
  id: 'global-collection-search-delay',
  name: 'Recherche',
  description: 'La recherche part d’elle-même après la frappe, et les filtres ne chargent la liste qu’une fois les changements finis.',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  mount(ctx) {
    const { signal, log } = ctx;
    trackListDelay({ source: globalCollectionList, signal, log });
    submitAfterTyping({
      signal,
      field: () => findGlobalCollectionFilters()?.field,
      submit: () => findGlobalCollectionFilters()?.submit,
    });
  },
};
