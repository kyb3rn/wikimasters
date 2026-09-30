import type { Feature } from '@/core/runtime';
import { CARD_DISPLAY_NAME, defineCardDisplay } from '@/services/card-display';

// Espacement du site à partir de 500 px : `min-[500px]:gap-3`.
const display = defineCardDisplay('trades-card-display', 12);

export const tradesCardDisplay: Feature = {
  id: 'trades-card-display',
  name: CARD_DISPLAY_NAME,
  description: "Taille des cartes à choisir pour un échange et espace entre elles.",
  category: 'Échanges',
  routes: ['/trades'],
  required: true,
  settings: display.settings,
  mount: display.mount,
};
