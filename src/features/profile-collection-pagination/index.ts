import { whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { replaceSitePagination } from '@/services/site-pagination';
import {
  findProfileCollectionFilters,
  findProfileCollectionPaginationBars,
  findProfileCollectionStates,
  isProfileCollectionList,
  isProfileCollectionLoading,
  readProfileCollectionPageLabel,
  readProfileCollectionQuery,
} from '@/site/profile';

/**
 * Comme la pagination de la Collection : la barre du site est cachée, la nôtre posée à sa place. Première,
 * dernière et numéro saisi changent l'état `page` de l'onglet, puis remontent en haut comme lui.
 */
export const profileCollectionPagination: Feature = {
  id: 'profile-collection-pagination',
  name: 'Pagination',
  description: 'Première et dernière page, et saut direct à une page.',
  category: 'Profil',
  routes: ['/profile/:name'],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    await whenBody();
    if (signal.aborted) return;
    replaceSitePagination(
      {
        findBars: findProfileCollectionPaginationBars,
        readLabel: readProfileCollectionPageLabel,
        isLoading: () => {
          const filters = findProfileCollectionFilters();
          return filters ? isProfileCollectionLoading(filters) : false;
        },
        isList: isProfileCollectionList,
        readPage: (url) => readProfileCollectionQuery(url).page,
        jump(_site, from, index) {
          const states = findProfileCollectionStates();
          if (states?.page.value !== from) return undefined;
          return () => {
            states.page.set(index);
            document.querySelector('main')?.scrollTo({ top: 0, behavior: 'smooth' });
          };
        },
      },
      { signal, log, hiddenClass: 'wm-pc-pagination-hidden' },
    );
  },
};
