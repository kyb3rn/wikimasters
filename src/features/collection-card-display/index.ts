import type { Feature } from '@/core/runtime';
import { CARD_DISPLAY_NAME, defineCardDisplay } from '@/services/card-display';
import { COLLECTION_ROUTE } from '@/site/collection';

// Espacement du site sur ordinateur : `md:gap-[26px]`.
const display = defineCardDisplay('collection-card-display', 26);

export const collectionCardDisplay: Feature = {
  id: 'collection-card-display',
  name: CARD_DISPLAY_NAME,
  description: 'Taille des cartes de la collection et espace entre elles.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  settings: display.settings,
  mount: display.mount,
};
