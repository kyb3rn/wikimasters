import { cardDisplayFeature } from '@/services/card-display';
import { COLLECTION_ROUTE } from '@/site/routes';

export const collectionCardDisplay = cardDisplayFeature({
  id: 'collection-card-display',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  description: 'Taille des cartes de la collection et espace entre elles.',
  // Espacement du site sur ordinateur : `md:gap-[26px]`.
  siteGap: 26,
});
