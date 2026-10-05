import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { CARD_GRID_MIRROR } from '@/services/card-display';
import { trackPrices } from '@/services/market';
import { FACE, readFaceCard } from '@/site/cards';
import { findGlobalCollectionGrid } from '@/site/global-collection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';
import { cx } from '@/ui/cx';
import { createSlot } from '@/ui/mount';
import { siteClass } from '@/ui/site';

const PRICES = 'wm-catalog-prices';
const CELL = 'wm-catalog-price';
/** Hauteur du bouton (très petit) et son écart sous la carte, comme dans la Collection. */
const PRICE_SPACE = 'calc(1.25rem + 6px)';

/*
 * Ici la face est la case de la grille : rien autour d'elle où poser le bouton. Un calque à nous couvre la rangée et
 * en reprend la mise en page (retours à la ligne, centrage, écarts hérités, réglage de la taille des cartes compris),
 * avec une case vide de la taille d'une face pour chacune : chaque bouton tombe sous sa carte sans rien mesurer. Les
 * faces s'allongent d'une marge qui lui fait la place ; le calque laisse passer les clics, sauf sur les boutons.
 */
const CSS = `
main :has(> .wm-root.${PRICES}) { position: relative; }
main :has(> .wm-root.${PRICES}) > ${FACE}, .${CELL} { margin-bottom: ${PRICE_SPACE}; }
.wm-root.${PRICES} {
  position: absolute; inset: 0; pointer-events: none; display: flex; flex-direction: inherit; flex-wrap: inherit;
  justify-content: inherit; align-items: inherit; align-content: inherit; gap: inherit;
}
.${CELL} { position: relative; }
.${CELL} > * { position: absolute; top: calc(100% + 6px); left: 0; right: 0; pointer-events: auto; }
`;

/** Les ventes ne sont relues qu'à leur changement : un prix qui dépasse la durée du cache passe au contour à ce rythme. */
const STALE_CHECK_MS = 60_000;

/**
 * Prix moyen sous chaque carte de Toutes les cartes, comme dans la Collection (`trackPrices`) : moyenne des 7
 * dernières ventes de la carte dans sa rareté, et leur nombre.
 */
export const globalCollectionPrices: Feature = {
  id: 'global-collection-prices',
  name: 'Prix moyen',
  description:
    "Moyenne des 7 dernières ventes de chaque carte dans sa rareté, et leur nombre. Un clic charge le prix ou l'actualise, puis ouvre l'historique du marché.",
  toggleLabel: 'Afficher le prix moyen des cartes',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const mirror = createSlot(signal);
    const prices = trackPrices({ signal, log: ctx.log, onChange: sync });

    function sync(): void {
      const grid = findGlobalCollectionGrid();
      if (!grid) {
        mirror.clear();
        return;
      }
      // Une case par face, même sans bouton (cache pas encore lu, carte illisible) : sinon les suivantes se décalent.
      const cells = grid.faces.map((face, index) => {
        const card = readFaceCard(face);
        return h('div', { key: card?.id ?? `#${index}`, class: cx(siteClass.faceSize, CELL) }, card && prices.button(card));
      });
      mirror.render(cells, { parent: grid.row, className: cx(CARD_GRID_MIRROR, PRICES) });
    }

    watchDom(sync, { signal });
    const timer = setInterval(sync, STALE_CHECK_MS);
    ctx.onDispose(() => clearInterval(timer));
  },
};
