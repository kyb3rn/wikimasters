import { cardDisplayFeature } from '@/services/card-display';
import { RESALE_ROUTE } from '@/site/routes';

export const resaleCardDisplay = /* @__PURE__ */ cardDisplayFeature({
  id: 'resale-card-display',
  category: 'Revente',
  routes: [RESALE_ROUTE],
  description: 'Taille des cartes de la page Revente et espace entre elles.',
  // Grille de la Collection : `md:gap-[26px]`.
  siteGap: 26,
});
