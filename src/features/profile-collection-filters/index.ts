import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { placeRarityFilter } from '@/services/list-search';
import { findProfileCollectionFilters } from '@/site/profile';

const AREA = 'wm-pc-filter-area';
/** Sur la zone des filtres quand l'ami a des étiquettes (deux listes au lieu d'une). */
const TAGGED = 'wm-pc-tagged';
const LINE = 'wm-pc-filter-line';
const FIELD = 'wm-pc-search-field';
const LISTS = 'wm-pc-lists';
const PLACEHOLDER = 'Rechercher par nom ou description';

/*
 * Ligne comme celle de la Collection : champ, cases de rareté, listes (étiquette, tri), puis le bouton de la
 * recherche (posé par profile-collection-search au bout des listes). Largeur sous laquelle elle ne tient plus
 * avec un champ de 300 px (listes à leur plus étroit) : le champ prend sa propre rangée, le reste dessous.
 */
const CSS = `
.${AREA} { container: wm-pc-filters / inline-size; }
.${LINE} { flex-direction: row; flex-wrap: wrap; align-items: stretch; }
.${LINE} > .${FIELD} { flex: 1 1 100%; }
.${LINE} > .${LISTS} { flex: 1 1 16rem; width: auto; }
@container wm-pc-filters (min-width: 840px) {
  .${AREA}:not(.${TAGGED}) .${LINE} { flex-wrap: nowrap; }
  .${AREA}:not(.${TAGGED}) .${LINE} > .${FIELD} { flex: 1 1 300px; min-width: 300px; }
  .${AREA}:not(.${TAGGED}) .${LINE} > .${LISTS} { flex: 0 1 auto; }
}
@container wm-pc-filters (min-width: 1000px) {
  .${LINE} { flex-wrap: nowrap; }
  .${LINE} > .${FIELD} { flex: 1 1 300px; min-width: 300px; }
  .${LINE} > .${LISTS} { flex: 0 1 auto; }
}
`;

/**
 * Filtres de la collection d'un ami présentés comme ceux de la Collection : pastilles de rareté du site en
 * cases collées entre le champ et les listes (chacune clique la sienne), même texte d'aide.
 */
export const profileCollectionFilters: Feature = {
  id: 'profile-collection-filters',
  name: 'Ligne des filtres',
  description: "Les filtres de la collection d'un ami sont présentés comme ceux de la Collection.",
  category: 'Profil',
  routes: ['/profile/:name'],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('profile-collection-filters', CSS);

    watchDom(
      () => {
        const filters = findProfileCollectionFilters();
        if (!filters) return;
        setClass(filters.area, AREA, true);
        setClass(filters.area, TAGGED, filters.tag !== undefined);
        setClass(filters.line, LINE, true);
        setClass(filters.field, FIELD, true);
        setClass(filters.lists, LISTS, true);
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
        const filters = findProfileCollectionFilters();
        return filters && { parent: filters.line, before: filters.lists, pills: filters.pills };
      },
    });

    ctx.onDispose(() => {
      for (const field of document.querySelectorAll<HTMLInputElement>(`input.${FIELD}`)) {
        if (field.dataset.wmPlaceholder !== undefined) field.placeholder = field.dataset.wmPlaceholder;
        delete field.dataset.wmPlaceholder;
      }
      for (const name of [AREA, TAGGED, LINE, FIELD, LISTS]) {
        document.querySelectorAll(`.${name}`).forEach((element) => element.classList.remove(name));
      }
    });
  },
};
