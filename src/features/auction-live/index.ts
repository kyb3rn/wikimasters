import { h } from 'preact';
import { watchDom } from '@/core/dom';
import { matchRoute } from '@/core/router';
import type { Feature } from '@/core/runtime';
import { AUCTION_MARKET_BUTTON, auctionChannel } from '@/site/marketplace';
import { findSiteRealtime, type RealtimeLink, type SiteRealtime } from '@/site/realtime';
import { AUCTION_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { LiveButton } from './LiveButton';

/** L'état du client change aussi au gré de ses minuteries (essais, délai d'abonnement dépassé), sans rien dans la page. */
const POLL_MS = 250;

/**
 * Page d'une enchère : état du temps réel de la page (canal `auction:<id>`), lu dans le client du site, et relance
 * de la connexion. Le serveur du site sature le soir : une page sans temps réel reste figée, sans rien dire. Le
 * canal rejoint, la page relit l'enchère d'elle-même : les mises manquées s'affichent.
 */
export const auctionLive: Feature = {
  id: 'auction-live',
  name: 'Mises en direct',
  toggleLabel: 'Afficher le bouton',
  description: 'Montre si les nouvelles mises arrivent en direct. Coupé, un clic relance la connexion, et les mises manquées s’affichent.',
  category: 'Marché',
  routes: [AUCTION_ROUTE],
  async mount(ctx) {
    const { signal, log } = ctx;
    if (!(await ctx.ready())) return;
    const auctionId = matchRoute(AUCTION_ROUTE, location.pathname)?.id;
    if (!auctionId) return;
    const channel = auctionChannel(auctionId);
    const slot = createSlot(signal);
    let realtime: SiteRealtime | undefined;
    // Client introuvable depuis ce bouton : pas de nouvelle recherche dans l'arbre de React à chaque image.
    let searchedFrom: Element | undefined;
    let shown: RealtimeLink | undefined;

    function reconnect(): void {
      try {
        realtime?.reconnect(channel);
      } catch (error) {
        log.error('relance du temps réel en échec', error);
        toast.error('La connexion n’a pas pu être relancée.', { title: 'Mises en direct' });
      }
      sync();
    }

    function sync(): void {
      const market = document.querySelector(AUCTION_MARKET_BUTTON);
      if (market && !realtime && market !== searchedFrom) {
        searchedFrom = market;
        realtime = findSiteRealtime(market);
        if (!realtime) log.warn('client temps réel du site introuvable');
      }
      if (!market?.parentElement || !realtime) {
        slot.clear();
        shown = undefined;
        return;
      }
      shown = realtime.link(channel);
      slot.render(h(LiveButton, { link: shown, onReconnect: reconnect }), { parent: market.parentElement, after: market, inline: true });
    }

    watchDom(sync, { signal });
    const poll = setInterval(() => {
      if (realtime && shown !== undefined && realtime.link(channel) !== shown) sync();
    }, POLL_MS);
    ctx.onDispose(() => clearInterval(poll));
  },
};
