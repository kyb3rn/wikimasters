import type { Feature } from '@/core/runtime';
import { toggleSelectionWithCtrl } from '@/services/selection';
import { findSelectionMode } from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';

export const collectionSelectionKey: Feature = {
  id: 'collection-selection-key',
  name: 'Sélection',
  toggleLabel: 'Activer ou quitter la sélection avec Ctrl',
  description: 'Un appui sur Ctrl, seul, active la sélection de cartes ; un autre la quitte.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  mount(ctx) {
    toggleSelectionWithCtrl(ctx, findSelectionMode);
  },
};
