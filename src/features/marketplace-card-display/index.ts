import type { Feature } from '@/core/runtime';
import { CARD_DISPLAY_NAME, defineCardDisplay } from '@/services/card-display';

// Espacement du site sur ordinateur : `md:gap-5`.
const display = defineCardDisplay('marketplace-card-display', 20);

export const marketplaceCardDisplay: Feature = {
  id: 'marketplace-card-display',
  name: CARD_DISPLAY_NAME,
  description: 'Taille des annonces (carte, mise et durée) et espace entre elles, dans tous les onglets du marché.',
  category: 'Marché',
  routes: ['/marketplace'],
  required: true,
  settings: display.settings,
  mount: display.mount,
};
