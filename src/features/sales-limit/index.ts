import type { Feature } from '@/core/runtime';
import { SALES_LIMIT_TEXTS, showSalesGauge } from '@/services/sales-gauge';
import { findMarketplaceTabs } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';

/** Compteur des historiques de ventes, sur les onglets « Parcourir » et « Recherche avancée » du marché. */
export const salesLimit: Feature = {
  id: 'sales-limit',
  ...SALES_LIMIT_TEXTS,
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  defaultOff: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    showSalesGauge(ctx, () => {
      const tabs = findMarketplaceTabs();
      return tabs !== undefined && (tabs.addedActive || tabs.active === 'browse');
    });
  },
};
