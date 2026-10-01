import type { Feature } from '@/core/runtime';
import { trackListDelay } from '@/services/list-search';
import { findProfileCollectionFilters, hasProfileCollectionCards, PROFILE_COLLECTION_SPINNER, profileCollectionList } from '@/site/profile';
import { PROFILE_ROUTE } from '@/site/routes';

/**
 * Comme la Collection : un changement de filtre ne charge la liste qu'après un délai sans autre changement
 * (frappe comprise), ses requêtes remplacées n'allant jamais au réseau ; la roue du site au-dessus de la grille
 * est cachée pendant l'attente. Le site affiche toute réponse, même d'une requête remplacée : celles-ci restent
 * sans réponse. Grille vide : la requête part aussitôt, sans quoi la roue du site remplacerait les filtres (et le
 * champ en cours de frappe) pendant toute l'attente ; de même pour la première liste de l'onglet, avant que ses
 * filtres n'apparaissent.
 */
export const profileCollectionSearchDelay: Feature = {
  id: 'profile-collection-search-delay',
  name: 'Recherche',
  description: "Les filtres ne chargent la liste qu'une fois les changements finis.",
  category: 'Profil',
  routes: [PROFILE_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    trackListDelay({
      source: profileCollectionList,
      signal,
      log,
      staleResponses: 'applied',
      immediate: () => {
        const filters = findProfileCollectionFilters();
        return !filters || !hasProfileCollectionCards(filters);
      },
      hideWhileWaiting: `main ${PROFILE_COLLECTION_SPINNER}`,
    });
  },
};
