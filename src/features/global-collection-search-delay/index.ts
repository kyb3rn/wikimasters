import type { Feature } from '@/core/runtime';
import { submitAfterTyping, trackListDelay } from '@/services/list-search';
import { findGlobalCollectionFilters, globalCollectionList } from '@/site/global-collection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';

/**
 * Comme la Collection : un changement de filtre que la recherche ne retient pas ne charge qu'après un court délai
 * sans autre changement ; sans « Empêcher le rechargement automatique », la recherche part aussi d'elle-même
 * après la frappe (le site attend Entrée ou son bouton, caché).
 */
export const globalCollectionSearchDelay: Feature = {
  id: 'global-collection-search-delay',
  name: 'Recherche',
  description:
    "Les filtres ne chargent la liste qu'une fois les changements finis ; sans « Empêcher le rechargement automatique », la recherche part d'elle-même après la frappe.",
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    trackListDelay({ source: globalCollectionList, signal, log });
    submitAfterTyping({ source: globalCollectionList, signal, submit: () => findGlobalCollectionFilters()?.submit });
  },
};
