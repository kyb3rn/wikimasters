import { cardDisplayFeature } from '@/services/card-display';
import { GUILD_ROUTE } from '@/site/routes';

export const guildCardDisplay = cardDisplayFeature({
  id: 'guild-card-display',
  category: 'Guilde',
  routes: [GUILD_ROUTE],
  description: 'Taille des cartes de la guilde (liste de souhaits) et espace entre elles.',
  // Espacement du site sur ordinateur : `md:gap-[26px]` (liste de souhaits de l'Accueil).
  siteGap: 26,
});
