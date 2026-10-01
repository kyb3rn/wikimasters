import { defineListSearchFeature } from '@/services/list-search';
import {
  findProfileCollectionFilters,
  findProfileCollectionPaginationBars,
  findProfileCollectionReload,
  profileCollectionList,
  readProfileCollectionChoice,
} from '@/site/profile';
import { paginationButtons } from '@/site/pagination';
import { PROFILE_ROUTE } from '@/site/routes';

/**
 * Comme la recherche de la Collection : un changement de tri, d'étiquette, de raretés ou de recherche reçoit la
 * liste déjà affichée ; notre bouton au bout des listes (ou Entrée) recharge avec les filtres tels qu'ils sont.
 * Tant qu'une recherche attend, la pagination est verrouillée. Revenir sur l'onglet recrée la page aux filtres
 * par défaut : sa première requête part pendant que sa roue remplace les filtres, son état est alors illisible et
 * rien n'est retenu.
 */
export const profileCollectionSearch = defineListSearchFeature({
  id: 'profile-collection-search',
  category: 'Profil',
  routes: [PROFILE_ROUTE],
  source: profileCollectionList,
  holdOptions: () => ({
    currentChoice: () => {
      const filters = findProfileCollectionFilters();
      return filters && readProfileCollectionChoice(filters);
    },
  }),
  buttonClass: 'wm-pc-search',
  place() {
    const filters = findProfileCollectionFilters();
    return filters && { parent: filters.lists, before: null, inline: true };
  },
  locked: () => paginationButtons(findProfileCollectionPaginationBars()),
  reloader: () => findProfileCollectionReload(),
});
