import { defineSettings } from '@/core/settings';

/** Réglages communs de l'historique des ventes, partout où il s'ouvre. */
export const marketSettings = defineSettings('market', {
  movingAverages: {
    type: 'boolean',
    label: 'Afficher les moyennes mobiles',
    description: 'Moyennes des 5 et des 12 dernières ventes sur le graphique.',
    primary: true,
    default: true,
  },
  recentKey: {
    type: 'boolean',
    label: 'Touche R : revenir aux 30 derniers jours',
    primary: true,
    default: true,
  },
  allKey: {
    type: 'boolean',
    label: 'Touche A : voir toutes les ventes',
    primary: true,
    default: true,
  },
  cacheHours: {
    type: 'number',
    label: 'Durée du cache',
    description: 'Au-delà, les ventes sont redemandées au site.',
    primary: true,
    default: 48,
    min: 1,
    max: 168,
    step: 1,
    unit: 'h',
  },
});
