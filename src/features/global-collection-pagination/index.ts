import type { Feature } from '@/core/runtime';
import { jumpByPageState, replaceSitePagination } from '@/services/site-pagination';
import { findGlobalCollectionFilters, findGlobalCollectionStates, globalCollectionList, isGlobalCollectionLoading } from '@/site/global-collection';
import { findPaginationBars } from '@/site/pagination';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';

/** Une page gardée par le site s'affiche sans requête : tenue pour affichée passé ce délai. */
const CACHED_PAGE_DELAY = 300;

/**
 * Comme la pagination de la Collection : la barre du site est cachée, la nôtre posée à sa place. Première,
 * dernière et numéro saisi changent l'état `page` de la page, puis remontent en haut comme elle le fait.
 * Pendant une recherche, sans total : pas de dernière page, suivante tant que le site en annonce une.
 */
export const globalCollectionPagination: Feature = {
  id: 'global-collection-pagination',
  name: 'Pagination',
  description: 'Première et dernière page, et saut direct à une page.',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    replaceSitePagination(
      {
        list: globalCollectionList,
        findBars: () => findPaginationBars(),
        isLoading: () => {
          const filters = findGlobalCollectionFilters();
          return filters ? isGlobalCollectionLoading(filters) : false;
        },
        jump: jumpByPageState(() => findGlobalCollectionStates()?.page),
        settleWithoutRequest: CACHED_PAGE_DELAY,
      },
      { signal, log },
    );
  },
};
