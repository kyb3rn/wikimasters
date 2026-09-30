import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { parseRarity, type Rarity } from '@/site/rarity';

/** `GET /api/marketplace/<auctionId>` : l'enchère affichée par sa page (`/marketplace/<auctionId>`). */
const AUCTION_PATH = /^\/api\/marketplace\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

/** Identifiant de l'enchère demandée, si c'est la requête de sa page. */
export function readAuctionRequest(request: NetRequest): string | undefined {
  if (request.method !== 'GET') return undefined;
  return AUCTION_PATH.exec(request.url.pathname)?.[1];
}

/** La carte (modèle) mise aux enchères. */
export interface AuctionCard {
  readonly id: string;
  readonly title: string;
  /** Rareté de l'exemplaire mis en vente (`snapshot_rarity`), sinon celle de la carte aujourd'hui. */
  readonly rarity: Rarity | undefined;
}

/**
 * Réponse `{ auction: { card_id, snapshot_rarity, card: { id, wikipedia_title, rarity, … }, … }, bids }`
 * (capture du 30/09/2026).
 */
export function parseAuctionCard(body: unknown): AuctionCard | undefined {
  const auction = isRecord(body) ? body.auction : undefined;
  if (!isRecord(auction) || !isRecord(auction.card)) return undefined;
  const { id, wikipedia_title: title, rarity } = auction.card;
  if (typeof id !== 'string' || id === '' || typeof title !== 'string') return undefined;
  return { id, title: title.trim(), rarity: parseRarity(auction.snapshot_rarity) ?? parseRarity(rarity) };
}
