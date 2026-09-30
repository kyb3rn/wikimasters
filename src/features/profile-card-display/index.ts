import type { Feature } from '@/core/runtime';
import { CARD_DISPLAY_NAME, defineCardDisplay } from '@/services/card-display';

// Espacement du site sur ordinateur : `md:gap-[26px]`.
const display = defineCardDisplay('profile-card-display', 26);

export const profileCardDisplay: Feature = {
  id: 'profile-card-display',
  name: CARD_DISPLAY_NAME,
  description: "Taille des cartes des profils (vitrines, collection, choix d'une carte de vitrine) et espace entre elles.",
  category: 'Profil',
  routes: ['/profile', '/profile/:name'],
  required: true,
  settings: display.settings,
  mount: display.mount,
};
