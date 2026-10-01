import type { Feature } from '@/core/runtime';
import { jumpByPageState, replaceSitePagination } from '@/services/site-pagination';
import {
  findProfileCollectionFilters,
  findProfileCollectionPaginationBars,
  findProfileCollectionStates,
  isProfileCollectionLoading,
  profileCollectionList,
} from '@/site/profile';
import { PROFILE_ROUTE } from '@/site/routes';

/**
 * Comme la pagination de la Collection : la barre du site est cachée, la nôtre posée à sa place. Première,
 * dernière et numéro saisi changent l'état `page` de l'onglet, puis remontent en haut comme lui.
 */
export const profileCollectionPagination: Feature = {
  id: 'profile-collection-pagination',
  name: 'Pagination',
  description: 'Première et dernière page, et saut direct à une page.',
  category: 'Profil',
  routes: [PROFILE_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    replaceSitePagination(
      {
        list: profileCollectionList,
        findBars: () => findProfileCollectionPaginationBars(),
        isLoading: () => {
          const filters = findProfileCollectionFilters();
          return filters ? isProfileCollectionLoading(filters) : false;
        },
        jump: jumpByPageState(() => findProfileCollectionStates()?.page),
      },
      { signal, log },
    );
  },
};
