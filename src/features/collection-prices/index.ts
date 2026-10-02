import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { trackPrices } from '@/services/market';
import { readFaceCard } from '@/site/cards';
import { COLLECTION_CARD_BOX, findCollectionFaces, SELECTION_OVERLAY } from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';
import { createSlots } from '@/ui/mount';

const PRICE = 'wm-card-price';
/** Hauteur du bouton (très petit) et son écart sous la carte. */
const PRICE_SPACE = 'calc(1.25rem + 6px)';

/*
 * Bouton du prix sous la carte, dans sa case : elle s'allonge d'autant. Le calque du mode sélection (anneau d'une
 * carte cochée, voile d'une carte en échange) couvre toute la case : ramené à la carte seule.
 */
const CSS = `
.wm-root.${PRICE} { display: block; width: 100%; margin-top: 6px; }
${COLLECTION_CARD_BOX}:has(> .wm-root.${PRICE}) > ${SELECTION_OVERLAY} { bottom: ${PRICE_SPACE}; }
`;

/** Les ventes ne sont relues qu'à leur changement : un prix qui dépasse la durée du cache passe au contour à ce rythme. */
const STALE_CHECK_MS = 60_000;

/**
 * Prix moyen sous chaque carte de la Collection, comme sous les annonces du marché (`trackPrices`) : moyenne des 7
 * dernières ventes de la carte dans sa rareté, et leur nombre. Pas d'écart ni de couleur : un exemplaire possédé
 * n'a pas de mise à comparer.
 */
export const collectionPrices: Feature = {
  id: 'collection-prices',
  name: 'Prix moyen',
  description:
    "Moyenne des 7 dernières ventes de chaque carte dans sa rareté, et leur nombre. Un clic charge le prix ou l'actualise, puis ouvre l'historique des ventes.",
  toggleLabel: 'Afficher le prix moyen des cartes',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const buttons = createSlots<HTMLElement>(signal);
    const prices = trackPrices({ signal, log: ctx.log, onChange: sync });

    function sync(): void {
      const seen = new Set<HTMLElement>();
      for (const face of findCollectionFaces()) {
        const box = face.parentElement;
        const card = readFaceCard(face);
        if (!box?.matches(COLLECTION_CARD_BOX) || !card) continue;
        // Cache pas encore lu : rien, plutôt qu'un « Charger le prix » qui changerait aussitôt.
        const button = prices.button(card);
        if (!button) continue;
        seen.add(box);
        buttons.render(box, button, { parent: box, className: PRICE });
      }
      buttons.prune((box) => seen.has(box));
    }

    watchDom(sync, { signal });
    const timer = setInterval(sync, STALE_CHECK_MS);
    ctx.onDispose(() => clearInterval(timer));
  },
};
