import { watchDom } from '@/core/dom';
import { matchRoute } from '@/core/router';
import type { Feature } from '@/core/runtime';
import type { AuctionStatus } from '@/site/api';
import { findAuctionFace, readAuctionStatus } from '@/site/marketplace';
import { AUCTION_ROUTE } from '@/site/routes';
import { STAMPS, syncStamps, unstampAll, type Stamp } from '@/ui/stamp';

const OWNER = 'auction-result';

/** Seules les enchères finalisées : passé la fin, la page affiche « Finalisation… » tant que le statut reste `active`. */
const RESULT_STAMPS: Partial<Record<AuctionStatus, Stamp>> = {
  settled_sold: { ...STAMPS.sold, revealable: true },
  settled_unsold: { ...STAMPS.unsold, revealable: true },
};

/**
 * Page d'une enchère terminée : sa carte tamponnée « Vendue » ou « Pas vendue », d'après le statut que la page
 * affiche (son état React, pas sa requête : le script peut démarrer après elle). La page relit l'enchère d'elle-même
 * à la fin du compte à rebours puis jusqu'à la finalisation : le tampon apparaît sans recharger.
 */
export const auctionResult: Feature = {
  id: 'auction-result',
  name: "Page d'une enchère",
  description: "Page d'une enchère terminée : carte tamponnée « Vendue » ou « Pas vendue ».",
  category: 'Marché',
  routes: [AUCTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    watchDom(
      () => {
        const auctionId = matchRoute(AUCTION_ROUTE, location.pathname)?.id;
        const face = auctionId ? findAuctionFace() : undefined;
        const status = auctionId && face ? readAuctionStatus(face, auctionId) : undefined;
        const stamp = status && RESULT_STAMPS[status];
        syncStamps(OWNER, face && stamp ? [[face, stamp]] : []);
      },
      { signal: ctx.signal },
    );
    ctx.onDispose(() => unstampAll(OWNER));
  },
};
