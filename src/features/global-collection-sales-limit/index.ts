import type { Feature } from '@/core/runtime';
import { SALES_LIMIT_TEXTS, showSalesGauge } from '@/services/sales-gauge';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';

/** Compteur des historiques de ventes dans Toutes les cartes, où chaque carte a son bouton du prix (global-collection-prices). */
export const globalCollectionSalesLimit: Feature = {
  id: 'global-collection-sales-limit',
  ...SALES_LIMIT_TEXTS,
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  defaultOff: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    showSalesGauge(ctx);
  },
};
