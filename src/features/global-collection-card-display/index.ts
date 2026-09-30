import type { Feature } from '@/core/runtime';
import { CARD_DISPLAY_NAME, defineCardDisplay } from '@/services/card-display';

// Espacement du site sur ordinateur : `md:gap-[26px]`.
const display = defineCardDisplay('global-collection-card-display', 26);

export const globalCollectionCardDisplay: Feature = {
  id: 'global-collection-card-display',
  name: CARD_DISPLAY_NAME,
  description: 'Taille des cartes du catalogue et espace entre elles.',
  category: 'Toutes les cartes',
  routes: ['/global-collection'],
  required: true,
  settings: display.settings,
  mount: display.mount,
};
