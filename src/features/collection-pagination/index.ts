import { whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { replaceSitePagination } from '@/services/site-pagination';
import {
  COLLECTION_ROUTE,
  findCollectionPageSetter,
  findCollectionPaginationBars,
  isCollectionList,
  isPageLoading,
  readCollectionQuery,
  readPageLabel,
} from '@/site/collection';

/**
 * Chaque barre de pagination du site est cachée, la nôtre posée juste après elle. Précédente et suivante
 * cliquent les boutons du site ; première, dernière et numéro saisi changent son état `page` (il n'a pas
 * de saut direct), puis font défiler jusqu'en haut du cadre, comme lui. Un verrou posé sur les boutons du
 * site (recherche en attente) désactive la nôtre.
 */
export const collectionPagination: Feature = {
  id: 'collection-pagination',
  name: 'Pagination',
  description: 'Première et dernière page, et saut direct à une page.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    await whenBody();
    if (signal.aborted) return;
    replaceSitePagination(
      {
        findBars: findCollectionPaginationBars,
        readLabel: readPageLabel,
        isLoading: (bars) => bars.some(isPageLoading),
        isList: isCollectionList,
        readPage: (url) => readCollectionQuery(url).page,
        jump(site, from, index) {
          const setPage = findCollectionPageSetter(site.bar, from);
          if (!setPage) return undefined;
          const frame = site.bar.parentElement;
          return () => {
            setPage(index);
            requestAnimationFrame(() => frame?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
          };
        },
      },
      { signal, log, hiddenClass: 'wm-collection-pagination-hidden' },
    );
  },
};
