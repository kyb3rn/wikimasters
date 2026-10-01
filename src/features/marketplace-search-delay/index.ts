import type { Feature } from '@/core/runtime';
import { submitAfterTyping, trackListDelay } from '@/services/list-search';
import { findMarketplaceFilters, marketplaceList } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';

/**
 * Comme la Collection : un changement de filtre que la recherche ne retient pas ne charge qu'après un court délai
 * sans autre changement, même juste après le retour d'une annonce (liste remise par le site sans requête) ; sans
 * « Empêcher le rechargement automatique », la recherche part aussi d'elle-même après la frappe (le site attend
 * Entrée ou son bouton, caché).
 */
export const marketplaceSearchDelay: Feature = {
  id: 'marketplace-search-delay',
  name: 'Recherche',
  description:
    "Les filtres ne chargent la liste qu'une fois les changements finis ; sans « Empêcher le rechargement automatique », la recherche part d'elle-même après la frappe.",
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    trackListDelay({ source: marketplaceList, signal, log });
    submitAfterTyping({ source: marketplaceList, signal, submit: () => findMarketplaceFilters()?.submit });
  },
};
