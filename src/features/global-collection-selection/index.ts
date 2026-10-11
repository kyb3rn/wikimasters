import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { filterLineEnd } from '@/services/list-search';
import {
  createSelectionUi,
  SELECTION_LEVEL,
  selectPageAction,
  siteAction,
  trackPressedRequests,
  type SelectionAction,
} from '@/services/selection';
import { isWishlistChange } from '@/site/api';
import { findGlobalCollectionCards, findGlobalCollectionFilters } from '@/site/global-collection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';
import { findSelectionBar, siteSelectionMode, type SelectionBar } from '@/site/selection';

/** Propriétaire du gris des cartes non cochées. */
const OWNER = 'global-collection-selection';

/* Au bout de la ligne des filtres, après « Charger les prix » (global-collection-load-prices) : le dernier, comme dans
   la Collection. */
const CSS = `.${SELECTION_LEVEL} { order: 1; }`;

/**
 * Mode sélection de Toutes les cartes, présenté comme celui de la Collection (`createSelectionUi`) : bouton du mode au
 * bout de la ligne des filtres, précédé de « n sélectionnées » ; barre du bas réduite à ses boutons (« Sélectionner
 * toute la page », « Retirer des souhaits (n) », « Ajouter aux souhaits (n) »), roue sur celui qui attend sa requête ;
 * cartes non cochées grisées. Le site reste le moteur : ses boutons, cachés, sont cliqués par les nôtres. Son message
 * d'erreur, caché avec sa rangée, passe en toast.
 */
export const globalCollectionSelection: Feature = {
  id: 'global-collection-selection',
  name: 'Sélection',
  description: 'Mode sélection de Toutes les cartes : bouton dans la ligne des filtres, barre de boutons.',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const ui = createSelectionUi(ctx, { owner: OWNER, sync });
    const wishes = trackPressedRequests({ match: isWishlistChange, signal, onChange: () => sync() });

    /** « Sélectionner toute la page », puis les boutons de la liste de souhaits, qui lancent chacun une requête. */
    function actions(bar: SelectionBar): SelectionAction[] {
      const page = selectPageAction(bar);
      const wishlist = bar.actions.map((button, index) => {
        const key = String(index);
        return siteAction(button, key, {
          busy: wishes.busy(key),
          onClick: () => {
            if (button.disabled) return;
            wishes.press(key);
            button.click();
          },
        });
      });
      return page ? [page, ...wishlist] : wishlist;
    }

    function sync(): void {
      const bar = findSelectionBar();
      const filters = findGlobalCollectionFilters();
      ui.render({
        mode: siteSelectionMode(),
        spot: filters ? { parent: filterLineEnd(filters.line, signal) } : undefined,
        bar,
        actions: bar ? actions(bar) : [],
        faces: findGlobalCollectionCards()?.map((card) => card.face) ?? [],
        errorTitle: 'Liste de souhaits',
      });
    }

    watchDom(sync, { signal });
  },
};
