import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findCardModals } from '@/site/cards';

export const cardModalStats: Feature = {
  id: 'card-modal-stats',
  name: 'Apparence',
  toggleLabel: "Masquer l'attaque et la défense à droite de la carte",
  description: 'Elles restent écrites sur la carte elle-même.',
  category: 'Modale de carte',
  routes: 'all',
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    watchDom(
      () => {
        for (const modal of findCardModals()) if (modal.statsBlock) ctx.hide(modal.statsBlock);
      },
      { signal: ctx.signal },
    );
  },
};
