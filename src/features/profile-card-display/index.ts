import { cardDisplayFeature } from '@/services/card-display';
import { MY_PROFILE_ROUTE, PROFILE_ROUTE } from '@/site/routes';

export const profileCardDisplay = cardDisplayFeature({
  id: 'profile-card-display',
  category: 'Profil',
  routes: [MY_PROFILE_ROUTE, PROFILE_ROUTE],
  description: "Taille des cartes des profils (vitrines, collection, choix d'une carte de vitrine) et espace entre elles.",
  // Espacement du site sur ordinateur : `md:gap-[26px]`.
  siteGap: 26,
});
