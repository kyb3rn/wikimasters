import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { applySearchPlaceholder, filterLineCss, placeRarityFilter } from '@/services/list-search';
import { findMarketplaceFilters } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { tokens } from '@/ui/theme';

const AREA = 'wm-market-filter-area';
const LINE = 'wm-market-filter-line';
const FIELD_BOX = 'wm-market-field-box';
const SORT = 'wm-market-sort';
const FIELD = 'wm-market-search-field';

/*
 * Ligne commune des listes (`filterLineCss`) : champ, cases de rareté, tri, puis le bouton de la recherche (posé
 * par marketplace-search), écarts de 12 px. Champ et tri sur le fond des champs de la Collection.
 */
const CSS = `${filterLineCss({ area: AREA, line: LINE, field: FIELD_BOX, sort: SORT }, { sortBasis: '14rem', sortMin: '10rem', gap: '0.75rem' })}
.${LINE} > .${SORT} { width: auto; background-color: ${tokens.surfaceLight}; }
.${FIELD} { background-color: ${tokens.surfaceLight}; }
`;

/**
 * Filtres de l'onglet « Parcourir » présentés comme ceux de la Collection : pastilles de rareté du site en
 * cases collées entre le champ et le tri (chacune clique la sienne), même texte d'aide. « Rechercher » du site
 * est caché : Entrée ou notre bouton lancent la recherche (marketplace-search).
 */
export const marketplaceFilters: Feature = {
  id: 'marketplace-filters',
  name: 'Ligne des filtres',
  description: 'Les filtres du marché sont présentés comme ceux de la Collection.',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const marks = classMarks(signal);
    watchDom(() => {
      const filters = findMarketplaceFilters();
      if (!filters) return;
      marks.only(AREA, [filters.area]);
      marks.only(LINE, [filters.line]);
      marks.only(FIELD_BOX, [filters.fieldBox]);
      marks.only(SORT, [filters.sort]);
      marks.only(FIELD, [filters.field]);
      ctx.hide(filters.submit);
      applySearchPlaceholder(filters.field, signal);
    }, { signal });

    placeRarityFilter({
      signal,
      locate: () => {
        const filters = findMarketplaceFilters();
        return filters && { parent: filters.line, before: filters.sort, pills: filters.pills };
      },
    });
  },
};
