import { isRecord } from '@/core/guards';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { normalizeText } from '@/core/text';
import { readAuctionCancel, readAuctionCreation } from '@/site/api';
import { findCardModals } from '@/site/cards';

/**
 * Exemplaires mis aux enchères depuis l'ouverture de l'onglet. Tant que l'enchère court, l'exemplaire
 * est réservé par le site : plus de défausse, d'étiquette, ni de nouvelle mise en vente.
 * Lu dans les requêtes du site (création réussie, retrait) ; oublié au rechargement de la page. Pas besoin de
 * guetter la fin de l'enchère : vendu, l'exemplaire n'existe plus ; invendu, il revient sous un autre identifiant.
 */
export interface Listing {
  readonly userCardId: string;
  readonly auctionId: string | undefined;
}

const listings = new Map<string, Listing>();
const changes = createListeners(createLogger('ventes'));
let started = false;

/**
 * Titre de la carte que le site met aux enchères, à lire au départ de sa requête : celle de la modale de carte
 * ouverte qui a « Mettre aux enchères » (la mise en vente s'ouvre par-dessus). Vide si elle est introuvable.
 */
export function listedCardTitle(): string {
  return normalizeText(findCardModals().find((modal) => modal.auctionButton)?.title);
}

/** Démarre le suivi (une fois pour tout le script ; sans effet ensuite). */
export function trackListings(): void {
  if (started) return;
  started = true;
  const isCreation = (request: NetRequest) => !request.own && readAuctionCreation(request) !== undefined;
  net.observe(isCreation, async (exchange) => {
    const created = readAuctionCreation(exchange.request);
    if (!created || !exchange.ok) return;
    const body = await exchange.json().catch(() => undefined);
    const auctionId = isRecord(body) && typeof body.auction_id === 'string' ? body.auction_id : undefined;
    listings.set(created.userCardId, { userCardId: created.userCardId, auctionId });
    changes.emit();
  });
  net.observe(
    (request) => readAuctionCancel(request) !== undefined,
    (exchange) => {
      const cancelled = readAuctionCancel(exchange.request);
      if (!exchange.ok || !cancelled) return;
      for (const [userCardId, listing] of listings) {
        if (listing.auctionId === cancelled.auctionId) listings.delete(userCardId);
      }
      changes.emit();
    },
  );
}

/** Enchère en cours pour cet exemplaire ? */
export function listingOf(userCardId: string): Listing | undefined {
  return listings.get(userCardId);
}

export function onListingsChange(listener: () => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}
