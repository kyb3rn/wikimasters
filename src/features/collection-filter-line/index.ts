import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { COLLECTION_ROUTE, findCollectionFilters, findCollectionSearchField } from '@/site/collection';

const AREA = 'wm-filter-area';
const LINE = 'wm-filter-line';
const FIELD = 'wm-search-field';
const PLACEHOLDER = 'Rechercher par nom ou description';
/**
 * Largeur de la ligne sous laquelle les deux côtés ne tiennent plus avec un champ de 300 px (cases de
 * rareté, deux listes et leurs boutons, compte et bouton de la sélection) : elle passe alors sur deux rangées.
 */
const TWO_ROWS_BELOW = '1320px';

/*
 * Ligne des filtres à partir de 768 px (le site l'y met sur une ligne) : à gauche la recherche, les raretés et
 * les listes ; à droite ce que le script pose au bout de la ligne (la sélection, conteneur `.wm-root` non
 * `inline`). Champ et côté droit partent de la même base de 550 px : le côté droit grandit seul (l'écart),
 * et quand la fenêtre se réduit, champ et écart rétrécissent ensemble, le champ jusqu'à 300 px. Trop étroit :
 * le côté droit passe sur sa propre rangée, le champ reprend la place (comme le site, 16 rem de base).
 */
const CSS = `
.${AREA} { container: wm-filters / inline-size; }
@media (min-width: 768px) {
  .${LINE} { flex-wrap: nowrap; }
  .${LINE} > .${FIELD} { flex: 0 1 550px; min-width: 300px; }
  .${LINE} > .wm-root:not(.wm-inline):last-child { flex: 1 1 550px; }
  @container wm-filters (max-width: ${TWO_ROWS_BELOW}) {
    .${LINE} { flex-wrap: wrap; }
    .${LINE} > .${FIELD} { flex: 1 1 16rem; min-width: 0; }
    .${LINE} > .wm-root:not(.wm-inline):last-child { flex: 1 1 100%; }
  }
}
`;

export const collectionFilterLine: Feature = {
  id: 'collection-filter-line',
  name: 'Ligne des filtres',
  description: 'La ligne des filtres de la Collection a deux côtés : la recherche et les filtres à gauche, la sélection à droite.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('collection-filter-line', CSS);

    watchDom(
      () => {
        const line = findCollectionFilters()?.row.parentElement;
        const field = findCollectionSearchField();
        if (!line || !field) return;
        if (line.parentElement) setClass(line.parentElement, AREA, true);
        setClass(line, LINE, true);
        setClass(field, FIELD, true);
        // React ne réécrit le texte d'aide que s'il change de son côté.
        if (field.placeholder !== PLACEHOLDER) {
          field.dataset.wmPlaceholder = field.placeholder;
          field.placeholder = PLACEHOLDER;
        }
      },
      { signal },
    );
    ctx.onDispose(() => {
      for (const field of document.querySelectorAll<HTMLInputElement>(`input.${FIELD}`)) {
        if (field.dataset.wmPlaceholder !== undefined) field.placeholder = field.dataset.wmPlaceholder;
        delete field.dataset.wmPlaceholder;
      }
      for (const name of [AREA, LINE, FIELD]) {
        document.querySelectorAll(`.${name}`).forEach((element) => element.classList.remove(name));
      }
    });
  },
};
