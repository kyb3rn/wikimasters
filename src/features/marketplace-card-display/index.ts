import { cardDisplayFeature } from '@/services/card-display';
import { MARKETPLACE_ROUTE } from '@/site/routes';

export const marketplaceCardDisplay = cardDisplayFeature({
  id: 'marketplace-card-display',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  description: 'Taille des annonces (carte, mise et durée) et espace entre elles, dans tous les onglets du marché.',
  // Espacement du site sur ordinateur : `md:gap-5`.
  siteGap: 20,
});
