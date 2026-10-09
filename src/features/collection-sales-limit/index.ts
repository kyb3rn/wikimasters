import type { Feature } from '@/core/runtime';
import { SALES_LIMIT_TEXTS, showSalesGauge } from '@/services/sales-gauge';
import { COLLECTION_ROUTE } from '@/site/routes';

/** Compteur des historiques de ventes dans la Collection, où chaque carte a son bouton du prix (collection-prices). */
export const collectionSalesLimit: Feature = {
  id: 'collection-sales-limit',
  ...SALES_LIMIT_TEXTS,
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  defaultOff: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    showSalesGauge(ctx);
  },
};
