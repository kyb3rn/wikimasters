import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { applySearchPlaceholder, filterLineCss, placeRarityFilter, WishlistToggle } from '@/services/list-search';
import { findGlobalCollectionFilters, findGlobalCollectionSearchNotice } from '@/site/global-collection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';

const AREA = 'wm-gc-filter-area';
const LINE = 'wm-gc-filter-line';
const FIELD_ROW = 'wm-gc-field-row';
const SORT = 'wm-gc-sort';

/*
 * Ligne commune des listes (`filterLineCss`) : champ, cases de rareté, liste de souhaits, tri, puis le bouton de la
 * recherche (posé par global-collection-search). Le cadre du tri perd sa largeur maximale.
 */
const CSS = `${filterLineCss({ area: AREA, line: LINE, field: FIELD_ROW, sort: SORT }, { sortBasis: '10rem', sortMin: '8.5rem' })}
.${LINE} > .${SORT} { max-width: none; }
`;

/**
 * Filtres de « Toutes les cartes » présentés comme ceux de la Collection : pastilles de rareté du site en cases
 * collées entre le champ et le tri (chacune clique la sienne), sa pastille « Liste de souhaits » en bouton
 * carré à côté (qui la clique), même texte d'aide. « Rechercher » du site est caché : Entrée ou notre bouton
 * lancent la recherche (global-collection-search). L'avertissement du site pendant une recherche (« Recherche
 * active : pas de décompte… ») est caché aussi.
 */
export const globalCollectionFilters: Feature = {
  id: 'global-collection-filters',
  name: 'Ligne des filtres',
  description: 'Les filtres du catalogue sont présentés comme ceux de la Collection.',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const marks = classMarks(signal);
    /** Cadre de l'avertissement caché : le même montre les compteurs par rareté quand la recherche est vide. */
    let notice: HTMLElement | undefined;
    watchDom(() => {
      const filters = findGlobalCollectionFilters();
      if (!filters) return;
      marks.only(AREA, [filters.area]);
      marks.only(LINE, [filters.line]);
      marks.only(FIELD_ROW, [filters.fieldRow]);
      marks.only(SORT, [filters.sortBox]);
      ctx.hide(filters.submit);
      const current = findGlobalCollectionSearchNotice(filters);
      if (notice && notice !== current) ctx.hide(notice, false);
      if (current) ctx.hide(current);
      notice = current;
      applySearchPlaceholder(filters.field, signal);
    }, { signal });

    placeRarityFilter({
      signal,
      locate: () => {
        const filters = findGlobalCollectionFilters();
        return filters && { parent: filters.line, before: filters.sortBox, pills: filters.pills };
      },
      after: () => {
        const wishlist = findGlobalCollectionFilters()?.wishlist;
        return wishlist ? h(WishlistToggle, { active: wishlist.active, onClick: () => findGlobalCollectionFilters()?.wishlist?.button.click() }) : null;
      },
    });
  },
};
