import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import { matchRoute } from '@/core/router';
import type { Feature } from '@/core/runtime';
import { openMarketModal } from '@/services/market';
import { parseAuctionCard, readAuctionRequest } from '@/site/api';
import type { CardRef } from '@/site/cards';
import { AUCTION_ROUTE } from '@/site/routes';
import { lockControl, unlockAll } from '@/ui/lock';

const OWNER = 'auction-market';

/** Bouton « Vue du marché » de la page d'une enchère, à côté du titre de la carte (icône lucide `chart-line`). */
const BUTTON = 'main button[aria-label="Vue du marché"]';

/**
 * Page d'une enchère : son bouton « Vue du marché » ouvre notre historique des ventes (ou, sans PRO, l'offre
 * PRO), pas la vue du site. La carte vient de la réponse de l'enchère, lue au passage ; pas encore vue : le
 * site garde la main.
 */
export const auctionMarket: Feature = {
  id: 'auction-market',
  name: 'Historique des ventes',
  description: "Page d'une enchère : « Vue du marché » ouvre l'historique des ventes de la carte.",
  category: 'Marché',
  // La page charge l'enchère en arrivant : sa réponse peut précéder le changement d'adresse.
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    const cards = new Map<string, CardRef>();
    let busy = false;

    net.observe(
      (request) => readAuctionRequest(request) !== undefined && !request.own,
      async (exchange) => {
        const auctionId = readAuctionRequest(exchange.request);
        if (!exchange.ok || !auctionId) return;
        const card = parseAuctionCard(await exchange.json().catch(() => undefined));
        if (card) cards.set(auctionId, card);
        else ctx.log.warn("carte de l'enchère illisible", auctionId);
      },
      { signal },
    );

    if (!(await ctx.ready())) return;

    const currentCard = () => {
      const auctionId = matchRoute(AUCTION_ROUTE, location.pathname)?.id;
      return auctionId ? cards.get(auctionId) : undefined;
    };

    // Historique en cours de chargement : la roue à la place du graphique.
    function sync(): void {
      const button = document.querySelector<HTMLButtonElement>(BUTTON);
      if (button) lockControl(button, { owner: OWNER, locked: busy, reason: "Chargement de l'historique…", busy });
    }

    // Avant React (écouteur de la racine) : le site n'ouvre pas sa vue.
    window.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const card = target?.closest(BUTTON) ? currentCard() : undefined;
        if (!card) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (busy) return;
        busy = true;
        sync();
        void openMarketModal(card).finally(() => {
          busy = false;
          sync();
        });
      },
      { capture: true, signal },
    );

    watchDom(sync, { signal });
    ctx.onDispose(() => unlockAll(OWNER));
  },
};
