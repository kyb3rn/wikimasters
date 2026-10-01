import { cardDisplayFeature } from '@/services/card-display';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';

export const globalCollectionCardDisplay = cardDisplayFeature({
  id: 'global-collection-card-display',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  description: 'Taille des cartes du catalogue et espace entre elles.',
  // Espacement du site sur ordinateur : `md:gap-[26px]`.
  siteGap: 26,
});
