import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findCardModals } from '@/site/cards';

const HIDDEN = 'wm-stats-hidden';

export const cardModalStats: Feature = {
  id: 'card-modal-stats',
  name: 'Apparence',
  toggleLabel: "Masquer l'attaque et la défense à droite de la carte",
  description: 'Elles restent écrites sur la carte elle-même.',
  category: 'Modale de carte',
  routes: 'all',
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('card-modal-stats', `.${HIDDEN} { display: none !important; }`);
    watchDom(
      () => {
        for (const modal of findCardModals()) if (modal.statsBlock) setClass(modal.statsBlock, HIDDEN, true);
      },
      { signal },
    );
    ctx.onDispose(() => document.querySelectorAll(`.${HIDDEN}`).forEach((el) => el.classList.remove(HIDDEN)));
  },
};
