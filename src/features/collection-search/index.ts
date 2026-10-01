import { defineListSearchFeature } from '@/services/list-search';
import { collectionList, findCollectionFilters, findCollectionPaginationBars, findCollectionRefresh } from '@/site/collection';
import { paginationButtons } from '@/site/pagination';
import { COLLECTION_ROUTE } from '@/site/routes';

/**
 * Recherche retenue de la Collection : un changement d'étiquette, de tri, de raretés ou de recherche n'est pas
 * envoyé au site, sa requête (liste et compteurs) reçoit la réponse déjà affichée. Notre bouton au bout des
 * listes, ou Entrée dans le champ, appelle l'actualisation de la page, qui charge avec les filtres tels qu'ils sont
 * (sa roue sur la grille pendant le chargement). Tant qu'une recherche attend, la pagination est verrouillée :
 * elle chargerait une autre page des nouveaux filtres sans leurs compteurs (le site ne les demande qu'en page 0).
 */
export const collectionSearch = defineListSearchFeature({
  id: 'collection-search',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  source: collectionList,
  buttonClass: 'wm-collection-search',
  place() {
    const filters = findCollectionFilters();
    return filters && { parent: filters.row, before: null, inline: true };
  },
  locked: () => paginationButtons(findCollectionPaginationBars()),
  reloader: () => findCollectionRefresh(),
});
