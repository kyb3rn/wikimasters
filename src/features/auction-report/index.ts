import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { siteReportButton } from '@/services/report-button';
import { findAuctionReport } from '@/site/marketplace';
import { AUCTION_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';

/** Page d'une enchère : « Signaler l'image » sur l'image de la carte, comme dans la modale de carte. */
export const auctionReport: Feature = {
  id: 'auction-report',
  name: "Page d'une enchère",
  description: "Page d'une enchère : « Signaler l'image » en bas à droite de l'image de la carte.",
  category: 'Marché',
  routes: [AUCTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    // Carte recréée par React (autre enchère) : le bouton est reposé.
    const slot = createSlot(ctx.signal);
    watchDom(
      () => {
        const report = findAuctionReport();
        if (!report) return;
        ctx.hide(report.block);
        slot.render(siteReportButton(report.button), { parent: report.imageArea });
      },
      { signal: ctx.signal },
    );
  },
};
