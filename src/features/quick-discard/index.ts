import type { Feature } from '@/core/runtime';
import { migrateLegacyProtections, quickDiscardSettings } from '@/services/quick-discard';

/** Réglages communs du défaussage rapide ; chaque endroit où il s'utilise a sa propre fonctionnalité. */
export const quickDiscard: Feature = {
  id: 'quick-discard',
  name: 'Défaussage rapide',
  description: "Défausse d'un clic, sans confirmation, sauf les cartes protégées.",
  category: 'Défaussage rapide',
  routes: 'all',
  required: true,
  settings: quickDiscardSettings,
  mount() {
    migrateLegacyProtections();
  },
};
