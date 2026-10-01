import type { Feature } from '@/core/runtime';
import { replaceSitePagination } from '@/services/site-pagination';
import { collectionList, findCollectionPageSetter, findCollectionPaginationBars, isPageLoading } from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';

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
  mount({ signal, log }) {
    replaceSitePagination(
      {
        list: collectionList,
        findBars: () => findCollectionPaginationBars(),
        isLoading: (bars) => bars.some(isPageLoading),
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
      { signal, log },
    );
  },
};
