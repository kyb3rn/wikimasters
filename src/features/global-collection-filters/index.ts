import { h } from 'preact';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { placeRarityFilter } from '@/services/list-search';
import { findGlobalCollectionFilters, findGlobalCollectionSearchNotice, GLOBAL_COLLECTION_ROUTE } from '@/site/global-collection';
import { WishlistToggle } from './WishlistToggle';

const AREA = 'wm-gc-filter-area';
const LINE = 'wm-gc-filter-line';
const FIELD_ROW = 'wm-gc-field-row';
const SORT = 'wm-gc-sort';
const SUBMIT = 'wm-gc-submit';
const FIELD = 'wm-gc-search-field';
const NOTICE = 'wm-gc-search-notice';
const PLACEHOLDER = 'Rechercher par nom ou description';
/** Largeur sous laquelle la ligne ne tient plus avec un champ de 300 px : le champ prend alors sa propre rangée. */
const ONE_ROW_FROM = '960px';

/*
 * Ligne comme celle de la Collection : champ, cases de rareté, liste de souhaits, tri, puis le bouton de la
 * recherche (posé par global-collection-search), à 8 px de la liste comme dans sa rangée des listes. Trop
 * étroite : le champ sur sa rangée, le reste dessous. « Rechercher » du site est caché : la recherche part
 * seule après la frappe (global-collection-search-delay), Entrée la lance toujours. L'avertissement du site
 * pendant une recherche (« Recherche active : pas de décompte… ») est caché aussi.
 */
const CSS = `
.${AREA} { container: wm-gc-filters / inline-size; }
.${LINE} { flex-direction: row; flex-wrap: wrap; align-items: stretch; }
.${LINE} > .${FIELD_ROW} { flex: 1 1 100%; }
.${LINE} > .${SORT} { flex: 1 1 8.5rem; max-width: none; }
.${LINE} .wm-list-search { margin-left: -0.25rem; }
.${SUBMIT}, .${NOTICE} { display: none !important; }
@container wm-gc-filters (min-width: ${ONE_ROW_FROM}) {
  .${LINE} { flex-wrap: nowrap; }
  .${LINE} > .${FIELD_ROW} { flex: 1 1 300px; min-width: 300px; }
  .${LINE} > .${SORT} { flex: 0 1 10rem; min-width: 8.5rem; }
}
`;

/**
 * Filtres de « Toutes les cartes » présentés comme ceux de la Collection : pastilles de rareté du site en cases
 * collées entre le champ et le tri (chacune clique la sienne), sa pastille « Liste de souhaits » en bouton
 * carré à côté (qui la clique), même texte d'aide.
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
    await whenBody();
    if (signal.aborted) return;
    injectStyle('global-collection-filters', CSS);

    watchDom(
      () => {
        const filters = findGlobalCollectionFilters();
        if (!filters) return;
        setClass(filters.area, AREA, true);
        setClass(filters.line, LINE, true);
        setClass(filters.fieldRow, FIELD_ROW, true);
        setClass(filters.sortBox, SORT, true);
        setClass(filters.submit, SUBMIT, true);
        setClass(filters.field, FIELD, true);
        const notice = findGlobalCollectionSearchNotice(filters);
        document.querySelectorAll(`.${NOTICE}`).forEach((element) => setClass(element, NOTICE, element === notice));
        if (notice) setClass(notice, NOTICE, true);
        // React ne réécrit le texte d'aide que s'il change de son côté.
        if (filters.field.placeholder !== PLACEHOLDER) {
          filters.field.dataset.wmPlaceholder = filters.field.placeholder;
          filters.field.placeholder = PLACEHOLDER;
        }
      },
      { signal },
    );

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

    ctx.onDispose(() => {
      for (const field of document.querySelectorAll<HTMLInputElement>(`input.${FIELD}`)) {
        if (field.dataset.wmPlaceholder !== undefined) field.placeholder = field.dataset.wmPlaceholder;
        delete field.dataset.wmPlaceholder;
      }
      for (const name of [AREA, LINE, FIELD_ROW, SORT, SUBMIT, FIELD, NOTICE]) {
        document.querySelectorAll(`.${name}`).forEach((element) => element.classList.remove(name));
      }
    });
  },
};
