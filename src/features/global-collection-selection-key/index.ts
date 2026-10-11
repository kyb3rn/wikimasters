import type { Feature } from '@/core/runtime';
import { toggleSelectionWithCtrl } from '@/services/selection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';
import { siteSelectionMode } from '@/site/selection';

export const globalCollectionSelectionKey: Feature = {
  id: 'global-collection-selection-key',
  name: 'Sélection',
  toggleLabel: 'Activer ou quitter la sélection avec Ctrl',
  description: 'Un appui sur Ctrl, seul, active la sélection de cartes ; un autre la quitte.',
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  mount(ctx) {
    toggleSelectionWithCtrl(ctx, siteSelectionMode);
  },
};
