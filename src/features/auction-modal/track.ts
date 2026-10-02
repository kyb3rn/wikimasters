import { isRecord } from '@/core/guards';
import type { Logger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { readAuctionCreation } from '@/site/api';
import { findAuctionModal, readAuctionModalCard, type AuctionModalCard } from '@/site/cards';
import { addSaleRecord } from './store';

/**
 * Note chaque mise en vente acceptée par le site : mise et durée lues dans sa requête, carte (et rareté de
 * l'exemplaire) dans la modale encore ouverte à son départ, numéro de l'enchère dans la réponse.
 */
export function trackSaleHistory({ log, signal }: { readonly log: Logger; readonly signal: AbortSignal }): void {
  const pending = new Map<string, AuctionModalCard>();
  const isCreation = (request: NetRequest) => !request.own && readAuctionCreation(request) !== undefined;

  net.track(
    isCreation,
    (request) => {
      const created = readAuctionCreation(request);
      const modal = findAuctionModal();
      const listed = modal && readAuctionModalCard(modal);
      if (!created) return undefined;
      if (!listed) {
        log.warn('mise en vente : carte illisible dans la modale, absente de l’historique');
        return undefined;
      }
      pending.set(created.userCardId, listed);
      return (status) => {
        // Sans réponse, aucun observateur ne la verra : oubliée ici.
        if (status === undefined || status >= 400) pending.delete(created.userCardId);
      };
    },
    { signal },
  );

  net.observe(
    isCreation,
    async (exchange) => {
      const created = readAuctionCreation(exchange.request);
      const listed = created && pending.get(created.userCardId);
      if (!created || !listed) return;
      pending.delete(created.userCardId);
      if (!exchange.ok || created.price === undefined) return;
      const body = await exchange.json().catch(() => undefined);
      await addSaleRecord(listed.card, {
        at: exchange.startedAt,
        price: created.price,
        minutes: created.minutes,
        rarity: listed.card.rarity,
        shiny: listed.shiny,
        auctionId: isRecord(body) && typeof body.auction_id === 'string' ? body.auction_id : undefined,
      });
    },
    { signal },
  );
}
