import type { Feature } from '@/core/runtime';
import { TRADES_ROUTE } from '@/site/routes';
import { findTradesPage } from '@/site/trades';
import { placeTabLineButton } from '@/services/tab-line';

/**
 * /trades : « Proposer un échange » au bout de la rangée des onglets, qui gardent le reste de la largeur ; leur trait
 * s'arrête avant le bouton. Le bouton du site, dans l'en-tête, est caché et cliqué par le nôtre.
 */
export const tradesTabLine: Feature = {
  id: 'trades-tab-line',
  name: 'Page des échanges',
  description: '« Proposer un échange » sur la ligne des onglets.',
  category: 'Échanges',
  routes: [TRADES_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    placeTabLineButton(ctx, {
      find: () => {
        const page = findTradesPage();
        return page && { tabBar: page.tabBar, source: page.newTrade, hidden: page.newTrade };
      },
      label: 'Proposer un échange',
      narrowLabel: 'Échanger',
      size: 'md',
      className: 'wm-trades-new',
    });
  },
};
