import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { net } from '@/core/net';
import { matchRoute } from '@/core/router';
import type { Feature } from '@/core/runtime';
import { openMarketModal, type MarketCard } from '@/services/market';
import { parseAuctionCard, readAuctionRequest } from '@/site/api';
import { lockControl, unlockAll } from '@/ui/lock';

const OWNER = 'auction-market';
const BUSY = 'wm-auction-market-busy';

/** Bouton « Vue du marché » de la page d'une enchère, à côté du titre de la carte (icône lucide `chart-line`). */
const BUTTON = 'main button[aria-label="Vue du marché"]';

const CSS = `
/* Historique en cours de chargement : une roue à la place du graphique. */
.${BUSY} svg.lucide-chart-line { display: none; }
.${BUSY}::before { content: ''; width: 18px; height: 18px; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: wm-spin 0.8s linear infinite; }
.${BUSY}.wm-site-disabled { opacity: 1 !important; }
@keyframes wm-spin { to { transform: rotate(360deg); } }
`;

/**
 * Page d'une enchère : son bouton « Vue du marché » ouvre notre historique des ventes (ou, sans PRO, l'offre
 * PRO), pas la vue du site. La carte vient de la réponse de l'enchère, lue au passage ; pas encore vue : le
 * site garde la main.
 */
export const auctionMarket: Feature = {
  id: 'auction-market',
  name: 'Historique des ventes',
  description: 'Page d’une enchère : « Vue du marché » ouvre l’historique des ventes de la carte.',
  category: 'Marché',
  // La page charge l'enchère en arrivant : sa réponse peut précéder le changement d'adresse.
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    const cards = new Map<string, MarketCard>();
    let busy = false;

    net.observe(
      (request) => readAuctionRequest(request) !== undefined && !request.own,
      async (exchange) => {
        const auctionId = readAuctionRequest(exchange.request);
        if (!exchange.ok || !auctionId) return;
        const card = parseAuctionCard(await exchange.json().catch(() => undefined));
        if (card) cards.set(auctionId, card);
        else ctx.log.warn('carte de l’enchère illisible', auctionId);
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;
    injectStyle('auction-market', CSS);

    const currentCard = () => {
      const auctionId = matchRoute('/marketplace/:id', location.pathname)?.id;
      return auctionId ? cards.get(auctionId) : undefined;
    };

    function sync(): void {
      const button = document.querySelector<HTMLButtonElement>(BUTTON);
      if (!button) return;
      setClass(button, BUSY, busy);
      lockControl(button, { owner: OWNER, locked: busy, reason: 'Chargement de l’historique…' });
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
    ctx.onDispose(() => {
      document.querySelectorAll(`.${BUSY}`).forEach((el) => el.classList.remove(BUSY));
      unlockAll(OWNER);
    });
  },
};
