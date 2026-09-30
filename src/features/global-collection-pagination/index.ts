import { whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { replaceSitePagination } from '@/services/site-pagination';
import {
  findGlobalCollectionFilters,
  findGlobalCollectionPaginationBars,
  findGlobalCollectionStates,
  GLOBAL_COLLECTION_ROUTE,
  isGlobalCollectionList,
  isGlobalCollectionLoading,
  readGlobalCollectionPageLabel,
  readGlobalCollectionQuery,
} from '@/site/global-collection';

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
  async mount(ctx) {
    const { signal, log } = ctx;
    await whenBody();
    if (signal.aborted) return;
    replaceSitePagination(
      {
        findBars: findGlobalCollectionPaginationBars,
        readLabel: readGlobalCollectionPageLabel,
        isLoading: () => {
          const filters = findGlobalCollectionFilters();
          return filters ? isGlobalCollectionLoading(filters) : false;
        },
        isList: isGlobalCollectionList,
        readPage: (url) => readGlobalCollectionQuery(url).page,
        jump(_site, from, index) {
          const states = findGlobalCollectionStates();
          if (states?.page.value !== from) return undefined;
          return () => {
            states.page.set(index);
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          };
        },
        settleWithoutRequest: CACHED_PAGE_DELAY,
      },
      { signal, log, hiddenClass: 'wm-gc-pagination-hidden' },
    );
  },
};
