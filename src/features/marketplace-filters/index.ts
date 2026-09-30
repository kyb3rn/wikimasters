import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { placeRarityFilter } from '@/services/list-search';
import { findMarketplaceFilters, MARKETPLACE_ROUTE } from '@/site/marketplace';
import { tokens } from '@/ui/theme';

const AREA = 'wm-market-filter-area';
const LINE = 'wm-market-filter-line';
const FIELD_BOX = 'wm-market-field-box';
const SORT = 'wm-market-sort';
const SUBMIT = 'wm-market-submit';
const FIELD = 'wm-market-search-field';
const PLACEHOLDER = 'Rechercher par nom ou description';
/** Largeur sous laquelle la ligne ne tient plus avec un champ de 300 px : le champ prend alors sa propre rangée. */
const ONE_ROW_FROM = '960px';

/*
 * Ligne comme celle de la Collection : champ, cases de rareté, tri, puis le bouton de la recherche (posé par
 * marketplace-search), écarts de 12 px, 8 px entre le tri et le bouton. Trop étroite : le champ sur sa
 * rangée, le reste dessous. Champ et tri sur le fond des champs de la Collection. « Rechercher » du site est
 * caché : la recherche part seule après la frappe (marketplace-search-delay), Entrée la lance toujours.
 */
const CSS = `
.${AREA} { container: wm-market-filters / inline-size; }
.${LINE} { flex-direction: row; flex-wrap: wrap; align-items: stretch; gap: 0.75rem; }
.${LINE} > .${FIELD_BOX} { flex: 1 1 100%; }
.${LINE} > .${SORT} { flex: 1 1 10rem; width: auto; background-color: ${tokens.surfaceLight}; }
.${FIELD} { background-color: ${tokens.surfaceLight}; }
.${LINE} .wm-list-search { margin-left: -0.25rem; }
.${SUBMIT} { display: none !important; }
@container wm-market-filters (min-width: ${ONE_ROW_FROM}) {
  .${LINE} { flex-wrap: nowrap; }
  .${LINE} > .${FIELD_BOX} { flex: 1 1 300px; min-width: 300px; }
  .${LINE} > .${SORT} { flex: 0 1 14rem; min-width: 10rem; }
}
`;

/**
 * Filtres de l'onglet « Parcourir » présentés comme ceux de la Collection : pastilles de rareté du site en
 * cases collées entre le champ et le tri (chacune clique la sienne), même texte d'aide.
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
    await whenBody();
    if (signal.aborted) return;
    injectStyle('marketplace-filters', CSS);

    watchDom(
      () => {
        const filters = findMarketplaceFilters();
        if (!filters) return;
        setClass(filters.area, AREA, true);
        setClass(filters.line, LINE, true);
        setClass(filters.fieldBox, FIELD_BOX, true);
        setClass(filters.sort, SORT, true);
        setClass(filters.submit, SUBMIT, true);
        setClass(filters.field, FIELD, true);
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
        const filters = findMarketplaceFilters();
        return filters && { parent: filters.line, before: filters.sort, pills: filters.pills };
      },
    });

    ctx.onDispose(() => {
      for (const field of document.querySelectorAll<HTMLInputElement>(`input.${FIELD}`)) {
        if (field.dataset.wmPlaceholder !== undefined) field.placeholder = field.dataset.wmPlaceholder;
        delete field.dataset.wmPlaceholder;
      }
      for (const name of [AREA, LINE, FIELD_BOX, SORT, SUBMIT, FIELD]) {
        document.querySelectorAll(`.${name}`).forEach((element) => element.classList.remove(name));
      }
    });
  },
};
