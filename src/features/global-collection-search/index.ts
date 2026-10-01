import { defineListSearchFeature } from '@/services/list-search';
import {
  findGlobalCollectionFilters,
  findGlobalCollectionReload,
  forgetGlobalCollectionPages,
  forgetGlobalCollectionPagesSoon,
  globalCollectionList,
  readGlobalCollectionChoice,
} from '@/site/global-collection';
import { findPaginationBars, paginationButtons } from '@/site/pagination';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';

/**
 * Comme la recherche de la Collection : un changement de tri, de raretés, de liste de souhaits ou de recherche
 * reçoit la liste déjà affichée ; notre bouton au bout de la ligne (ou Entrée) lance le texte du champ s'il a
 * changé, sinon recharge avec les choix tels qu'ils sont. Tant qu'une recherche attend, la pagination est
 * verrouillée. Les pages que le site garde dans l'onglet sont oubliées : sans quoi un changement s'afficherait
 * sans requête, et une liste resservie resterait gardée sous d'autres filtres que les siens.
 */
export const globalCollectionSearch = defineListSearchFeature({
  id: 'global-collection-search',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  source: globalCollectionList,
  holdOptions(signal) {
    // Dès l'arrivée : la première liste doit être demandée pour être retenue.
    forgetGlobalCollectionPages();
    const forget = () => forgetGlobalCollectionPagesSoon(signal);
    return {
      currentChoice: () => {
        const filters = findGlobalCollectionFilters();
        return filters && readGlobalCollectionChoice(filters);
      },
      onHeld: forget,
      onShown: forget,
    };
  },
  buttonClass: 'wm-gc-search',
  place() {
    const filters = findGlobalCollectionFilters();
    return filters && { parent: filters.line, after: filters.sortBox, inline: true };
  },
  locked: () => paginationButtons(findPaginationBars()),
  reloader: () => findGlobalCollectionReload(),
  submit: () => findGlobalCollectionFilters()?.submit,
  onLaunch: forgetGlobalCollectionPages,
});
