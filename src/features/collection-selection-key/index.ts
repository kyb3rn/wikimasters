import type { Feature } from '@/core/runtime';
import { COLLECTION_ROUTE, findSelectionMode } from '@/site/collection';
import { topSiteModal } from '@/site/modals';
import { isModalOpen } from '@/ui/modal';
import { createCtrlTap } from './tap';

export const collectionSelectionKey: Feature = {
  id: 'collection-selection-key',
  name: 'Sélection',
  toggleLabel: 'Activer ou quitter la sélection avec Ctrl',
  description: 'Un appui sur Ctrl, seul, active la sélection de cartes ; un autre la quitte.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  mount(ctx) {
    const { signal, log } = ctx;
    const tap = createCtrlTap();
    const cancel = () => tap.cancel();

    window.addEventListener('keydown', (event) => tap.keydown(event, performance.now()), { capture: true, signal });
    window.addEventListener(
      'keyup',
      (event) => {
        if (!tap.keyup(event, performance.now())) return;
        // Une modale ouverte (carte, étiquetage de la sélection…) : quitter la sélection la viderait dessous.
        if (isModalOpen() || topSiteModal()) return;
        const mode = findSelectionMode();
        if (!mode) return;
        log.debug(mode.active ? 'sélection quittée (Ctrl)' : 'sélection activée (Ctrl)');
        mode.toggle();
      },
      { capture: true, signal },
    );
    for (const type of ['pointerdown', 'wheel'] as const) window.addEventListener(type, cancel, { capture: true, passive: true, signal });
    window.addEventListener('blur', cancel, { signal });
  },
};
