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
 * Lu dans les requêtes du site (création réussie, retrait) ; oublié au rechargement de la page.
 */
export interface Listing {
  readonly userCardId: string;
  /** Titre de la carte (modale ouverte au moment de la mise en vente). */
  readonly title: string;
  readonly auctionId: string | undefined;
}

const listings = new Map<string, Listing>();
const changes = createListeners(createLogger('ventes'));
/** Titre de la carte au départ de la requête, en attendant la réponse. */
const titles = new Map<string, string>();
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
  net.track(isCreation, (request) => {
    const created = readAuctionCreation(request);
    if (!created) return undefined;
    titles.set(created.userCardId, listedCardTitle());
    return (status) => {
      // Sans réponse, aucun observateur ne la verra : le titre est oublié ici.
      if (status === undefined || status >= 400) titles.delete(created.userCardId);
    };
  });
  net.observe(isCreation, async (exchange) => {
    const created = readAuctionCreation(exchange.request);
    if (!created || !exchange.ok) return;
    const title = titles.get(created.userCardId) ?? '';
    titles.delete(created.userCardId);
    const body = await exchange.json().catch(() => undefined);
    const auctionId = isRecord(body) && typeof body.auction_id === 'string' ? body.auction_id : undefined;
    listings.set(created.userCardId, { userCardId: created.userCardId, title, auctionId });
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

/** Une carte de ce titre a-t-elle un exemplaire aux enchères ? (modale de carte : on n'y connaît que le titre) */
export function isTitleListed(title: string | undefined): boolean {
  const wanted = normalizeText(title);
  return wanted !== '' && [...listings.values()].some((listing) => listing.title === wanted);
}

export function onListingsChange(listener: () => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}
