import { whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { placeRarityFilter } from '@/services/list-search';
import { COLLECTION_ROUTE, findCollectionFilters, findRarityPills } from '@/site/collection';

/**
 * Les pastilles de rareté du site deviennent des cases collées, entre le champ de recherche et les listes :
 * à la hauteur des champs, cochées dans la couleur de la rareté. Chaque case clique la pastille du site
 * (cachée) : le filtre reste le sien, et `collection-search` retient son changement comme celui des listes.
 * La mise en page de la ligne (largeurs, passage à la ligne) est celle de collection-filter-line.
 */
export const collectionRarities: Feature = {
  id: 'collection-rarities',
  name: 'Filtre des raretés',
  description: 'Les raretés se cochent dans une rangée de cases collées, entre la recherche et les listes.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    placeRarityFilter({
      signal,
      locate: () => {
        const filters = findCollectionFilters();
        const parent = filters?.row.parentElement;
        const pills = findRarityPills();
        return filters && parent && pills ? { parent, before: filters.row, pills } : undefined;
      },
    });
  },
};
