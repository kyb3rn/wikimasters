import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import { matchRoute } from '@/core/router';
import type { Feature } from '@/core/runtime';
import { openMarketModal } from '@/services/market';
import { fetchAuctionCard, parseAuctionCard, readAuctionRequest, siteErrorText } from '@/site/api';
import type { CardRef } from '@/site/cards';
import { AUCTION_MARKET_BUTTON, readAuctionCard } from '@/site/marketplace';
import { AUCTION_ROUTE } from '@/site/routes';
import { lockControl, unlockAll } from '@/ui/lock';
import { toast } from '@/ui/toast';

const OWNER = 'auction-market';

/**
 * Page d'une enchère : son bouton « Vue du marché » ouvre toujours notre historique du marché (ou, sans PRO, l'offre
 * PRO), jamais la vue du site. La carte vient de la réponse de l'enchère, lue au passage, sinon de l'état de la page
 * (script démarré après sa requête), sinon de l'enchère redemandée.
 */
export const auctionMarket: Feature = {
  id: 'auction-market',
  name: 'Historique du marché',
  description: "Page d'une enchère : « Vue du marché » ouvre l'historique du marché de la carte.",
  category: 'Marché',
  // La page charge l'enchère en arrivant : sa réponse peut précéder le changement d'adresse.
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    const cards = new Map<string, CardRef>();
    let busy = false;

    net.observe(
      (request) => readAuctionRequest(request) !== undefined && !request.own,
      async (exchange) => {
        const auctionId = readAuctionRequest(exchange.request);
        if (!exchange.ok || !auctionId) return;
        const card = parseAuctionCard(await exchange.json().catch(() => undefined));
        if (card) cards.set(auctionId, card);
        else log.warn("carte de l'enchère illisible", auctionId);
      },
      { signal },
    );

    if (!(await ctx.ready())) return;

    async function cardOf(auctionId: string, button: Element): Promise<CardRef> {
      const known = cards.get(auctionId) ?? readAuctionCard(button, auctionId);
      if (known) return known;
      log.warn("carte de l'enchère ni vue passer ni dans l'état de la page : redemandée", auctionId);
      const card = await fetchAuctionCard(auctionId);
      cards.set(auctionId, card);
      return card;
    }

    async function open(auctionId: string, button: Element): Promise<void> {
      let card: CardRef;
      try {
        card = await cardOf(auctionId, button);
      } catch (error) {
        toast.error(siteErrorText(error), { title: 'Marché indisponible' });
        return;
      }
      await openMarketModal(card);
    }

    // Historique en cours de chargement : la roue à la place du graphique.
    function sync(): void {
      const button = document.querySelector<HTMLButtonElement>(AUCTION_MARKET_BUTTON);
      if (button) lockControl(button, { owner: OWNER, locked: busy, reason: "Chargement de l'historique…", busy });
    }

    // Avant React (écouteur de la racine) : le site n'ouvre jamais sa vue.
    window.addEventListener(
      'click',
      (event) => {
        const target = event.target instanceof Element ? event.target : null;
        const button = target?.closest(AUCTION_MARKET_BUTTON);
        const auctionId = matchRoute(AUCTION_ROUTE, location.pathname)?.id;
        if (!button || !auctionId) return;
        event.preventDefault();
        event.stopImmediatePropagation();
        if (busy) return;
        busy = true;
        sync();
        void open(auctionId, button).finally(() => {
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
