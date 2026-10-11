import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { trackPrices } from '@/services/market';
import { CARD_CELL, readFaceCard } from '@/site/cards';
import { findGlobalCollectionCards } from '@/site/global-collection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';
import { SELECTION_OVERLAY } from '@/site/selection';
import { createSlots } from '@/ui/mount';

const PRICE = 'wm-catalog-price';
/** Hauteur du bouton (très petit) et son écart sous la carte. */
const PRICE_SPACE = 'calc(1.25rem + 6px)';

/*
 * Bouton du prix sous la carte, dans sa case : elle s'allonge d'autant. Le calque du mode sélection, sur toute la
 * case comme dans la Collection, est ramené à la carte seule.
 */
const CSS = `
.wm-root.${PRICE} { display: block; width: 100%; margin-top: 6px; }
${CARD_CELL}:has(> .wm-root.${PRICE}) > ${SELECTION_OVERLAY} { bottom: ${PRICE_SPACE}; }
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

    const buttons = createSlots<HTMLElement>(signal);
    const prices = trackPrices({ signal, log: ctx.log, onChange: sync });

    function sync(): void {
      const seen = new Set<HTMLElement>();
      for (const { cell, face } of findGlobalCollectionCards() ?? []) {
        const card = readFaceCard(face);
        // Cache pas encore lu : rien, plutôt qu'un « Charger le prix » qui changerait aussitôt.
        const button = card && prices.button(card);
        if (!button) continue;
        seen.add(cell);
        buttons.render(cell, button, { parent: cell, className: PRICE });
      }
      buttons.prune((cell) => seen.has(cell));
    }

    watchDom(sync, { signal });
    const timer = setInterval(sync, STALE_CHECK_MS);
    ctx.onDispose(() => clearInterval(timer));
  },
};
