import type { IconName } from '@/ui/icons';

/** Onglet fixe, toujours en dernier. */
export const ABOUT = 'À propos';

/**
 * Onglets de la fenêtre, dans leur ordre, chacun avec son icône : celle de la navigation ou des boutons du site quand
 * il en a une (Amis, Messages : celles de son menu). Toute nouvelle catégorie y reçoit la sienne ; oubliée, elle
 * passerait sans icône juste avant « À propos ».
 */
export const TAB_ICONS: Readonly<Record<string, IconName>> = {
  Général: 'settings',
  'Défaussage rapide': 'trash',
  Paquets: 'puzzle',
  'Modale de carte': 'window',
  Enchères: 'gavel',
  Collection: 'collection',
  Échanges: 'handshake',
  Marché: 'market',
  Profil: 'user',
  'Toutes les cartes': 'globe',
  Guilde: 'castle',
  Amis: 'users',
  Messages: 'message',
  Notifications: 'bell',
  Développement: 'bug',
  [ABOUT]: 'info',
};

/** Onglets des catégories données, dans l'ordre de `TAB_ICONS`, puis « À propos ». */
export function orderTabs(categories: Iterable<string>): string[] {
  const present = new Set(categories);
  present.delete(ABOUT);
  const known = Object.keys(TAB_ICONS).filter((tab) => present.has(tab));
  const others = [...present].filter((tab) => !Object.hasOwn(TAB_ICONS, tab));
  return [...known, ...others, ABOUT];
}
