import { classMarks, ROOT_CLASS, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { applySearchPlaceholder, placeRarityFilter } from '@/services/list-search';
import { findCollectionFilters, findCollectionSearchField } from '@/site/collection';
import { findRarityPills } from '@/site/rarity-pills';
import { COLLECTION_ROUTE } from '@/site/routes';
import { INLINE_CLASS } from '@/ui/theme';

const AREA = 'wm-collection-filter-area';
const LINE = 'wm-collection-filter-line';
const FIELD = 'wm-collection-search-field';
/** Ce que le script pose au bout de la ligne (la sélection) : conteneur non `inline`, dernier enfant. */
const RIGHT = `.${ROOT_CLASS}:not(.${INLINE_CLASS}):last-child`;
/**
 * Largeur de la ligne sous laquelle les deux côtés ne tiennent plus avec un champ de 300 px (cases de
 * rareté, deux listes et leurs boutons, compte et bouton de la sélection) : elle passe alors sur deux rangées.
 */
const TWO_ROWS_BELOW = '1320px';

/*
 * Ligne des filtres à partir de 768 px (le site l'y met sur une ligne) : à gauche la recherche, les raretés et
 * les listes ; à droite la sélection. Champ et côté droit partent de la même base de 550 px : le côté droit
 * grandit seul (l'écart), et quand la fenêtre se réduit, champ et écart rétrécissent ensemble, le champ jusqu'à
 * 300 px. Trop étroit : le côté droit passe sur sa propre rangée, le champ reprend la place (comme le site, 16 rem
 * de base).
 */
const CSS = `
.${AREA} { container: ${AREA} / inline-size; }
@media (min-width: 768px) {
  .${LINE} { flex-wrap: nowrap; }
  .${LINE} > .${FIELD} { flex: 0 1 550px; min-width: 300px; }
  .${LINE} > ${RIGHT} { flex: 1 1 550px; }
  @container ${AREA} (max-width: ${TWO_ROWS_BELOW}) {
    .${LINE} { flex-wrap: wrap; }
    .${LINE} > .${FIELD} { flex: 1 1 16rem; min-width: 0; }
    .${LINE} > ${RIGHT} { flex: 1 1 100%; }
  }
}
`;

/**
 * Ligne des filtres de la Collection, comme celles des autres listes : même texte d'aide, pastilles de rareté du
 * site en cases collées entre le champ et les listes. Chaque case clique la pastille du site (cachée) : le filtre
 * reste le sien, et collection-search retient son changement comme celui des listes.
 */
export const collectionFilters: Feature = {
  id: 'collection-filters',
  name: 'Ligne des filtres',
  description:
    'Les filtres de la Collection tiennent sur une ligne : la recherche, les raretés en cases collées et les listes à gauche, la sélection à droite.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const marks = classMarks(signal);
    watchDom(() => {
      const line = findCollectionFilters()?.row.parentElement;
      const field = findCollectionSearchField();
      if (!line || !field) return;
      marks.only(AREA, line.parentElement ? [line.parentElement] : []);
      marks.only(LINE, [line]);
      marks.only(FIELD, [field]);
      applySearchPlaceholder(field, signal);
    }, { signal });

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
