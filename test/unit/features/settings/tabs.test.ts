import { describe, expect, it } from 'vitest';
import { ABOUT, orderTabs, TAB_ICONS } from '@/features/settings/tabs';

describe('onglets des paramètres', () => {
  it('suivent l’ordre de TAB_ICONS, quel que soit celui des fonctionnalités, « À propos » en dernier', () => {
    expect(orderTabs(['Notifications', 'Marché', 'Paquets', 'Marché', 'Défaussage rapide'])).toEqual([
      'Défaussage rapide',
      'Paquets',
      'Marché',
      'Notifications',
      ABOUT,
    ]);
  });

  it('une catégorie sans icône passe juste avant « À propos »', () => {
    expect(orderTabs(['Nouvelle', 'Paquets', ABOUT])).toEqual(['Paquets', 'Nouvelle', ABOUT]);
  });

  it('Amis et Messages ont l’icône de la navigation du site', () => {
    expect(TAB_ICONS.Amis).toBe('users');
    expect(TAB_ICONS.Messages).toBe('message');
  });
});
