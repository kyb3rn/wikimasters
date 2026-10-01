import { cardDisplayFeature } from '@/services/card-display';
import { findTradeComposer } from '@/site/trades';

/** La fenêtre d'échange s'ouvre aussi des amis, des profils et du catalogue : elle garde ce réglage partout. */
export const tradesCardDisplay = cardDisplayFeature({
  id: 'trades-card-display',
  category: 'Échanges',
  routes: 'all',
  description: 'Taille des cartes à choisir pour un échange et espace entre elles.',
  // Espacement du site à partir de 500 px : `min-[500px]:gap-3`.
  siteGap: 12,
  container: () => findTradeComposer()?.root,
});
