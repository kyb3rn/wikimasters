import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import { findCardModals, readAuctionCancel, readAuctionCreation } from '@/site/cards';

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
const listeners = new Set<() => void>();
/** Titre de la carte au moment de la requête, en attendant la réponse. */
const titles = new Map<string, string>();
let started = false;

const normalize = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch {
      // Un abonné défaillant n'empêche pas les autres d'être prévenus.
    }
  }
}

/** Démarre le suivi (une fois pour tout le script ; sans effet ensuite). */
export function trackListings(): void {
  if (started) return;
  started = true;
  net.intercept(
    (request) => readAuctionCreation(request) !== undefined,
    (request) => {
      const created = readAuctionCreation(request);
      const modal = findCardModals().find((m) => m.auctionButton);
      if (created) titles.set(created.userCardId, normalize(modal?.title));
      return undefined;
    },
  );
  net.observe(
    (request) => readAuctionCreation(request) !== undefined,
    async (exchange) => {
      const created = readAuctionCreation(exchange.request);
      if (!created) return;
      const title = titles.get(created.userCardId) ?? '';
      titles.delete(created.userCardId);
      if (!exchange.ok) return;
      const body = await exchange.json().catch(() => undefined);
      const auctionId = isRecord(body) && typeof body.auction_id === 'string' ? body.auction_id : undefined;
      listings.set(created.userCardId, { userCardId: created.userCardId, title, auctionId });
      notify();
    },
  );
  net.observe(
    (request) => readAuctionCancel(request) !== undefined,
    (exchange) => {
      const cancelled = readAuctionCancel(exchange.request);
      if (!exchange.ok || !cancelled) return;
      for (const [userCardId, listing] of listings) {
        if (listing.auctionId === cancelled.auctionId) listings.delete(userCardId);
      }
      notify();
    },
  );
}

/** Enchère en cours pour cet exemplaire ? */
export function listingOf(userCardId: string): Listing | undefined {
  return listings.get(userCardId);
}

/** Une carte de ce titre a-t-elle un exemplaire aux enchères ? (modale de carte : on n'y connaît que le titre) */
export function isTitleListed(title: string | undefined): boolean {
  const wanted = normalize(title);
  return wanted !== '' && [...listings.values()].some((listing) => listing.title === wanted);
}

export function onListingsChange(listener: () => void, options: { signal: AbortSignal }): void {
  if (options.signal.aborted) return;
  listeners.add(listener);
  options.signal.addEventListener('abort', () => listeners.delete(listener), { once: true });
}
