import { defineListSearchFeature } from '@/services/list-search';
import { findMarketplaceFilters, findMarketplaceLoadMore, findMarketplaceRefresh, marketplaceList, readMarketplaceChoice } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';

/**
 * Comme la recherche de la Collection : un changement de tri, de raretés ou de recherche reçoit la liste déjà
 * affichée (sa première page) ; notre bouton au bout de la ligne (ou Entrée) lance le texte du champ s'il a
 * changé, sinon appelle l'actualisation de la page, qui charge avec les choix tels qu'ils sont (roue pendant le
 * chargement : le site n'en montre aucune). Tant qu'une recherche attend, « Charger la suite » est verrouillé :
 * il ajouterait la suite des nouveaux filtres à la liste des anciens.
 */
export const marketplaceSearch = defineListSearchFeature({
  id: 'marketplace-search',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  source: marketplaceList,
  holdOptions: () => ({
    currentChoice: () => {
      const filters = findMarketplaceFilters();
      return filters && readMarketplaceChoice(filters);
    },
    // Resservir la première page effacerait celles que « Charger la suite » a ajoutées.
    heldReply: 'none',
  }),
  buttonClass: 'wm-market-search',
  place() {
    const filters = findMarketplaceFilters();
    return filters && { parent: filters.line, after: filters.sort, inline: true };
  },
  locked: () => [findMarketplaceLoadMore()].filter((button) => button !== undefined),
  reloader: () => findMarketplaceRefresh(),
  submit: () => findMarketplaceFilters()?.submit,
});
