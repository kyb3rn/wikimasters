import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { parseCardRef, type CardRef } from '@/site/cards';
import { parseRarity } from '@/site/rarity';

/**
 * Enchères du marché (code du site, 29/09/2026) :
 * - mise aux enchères d'un exemplaire : `POST /api/marketplace` `{ card_id: <exemplaire>, base_amount, duration_minutes }` ;
 * - annonce retirée : `DELETE /api/marketplace/<id>` (l'exemplaire revient dans la collection) ;
 * - l'enchère affichée par sa page (`/marketplace/<id>`) : `GET /api/marketplace/<id>`.
 */
const AUCTIONS = '/api/marketplace';
const AUCTION_PATH = /^\/api\/marketplace\/([^/]+)$/;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function auctionIdOf(request: NetRequest): string | undefined {
  const id = AUCTION_PATH.exec(request.url.pathname)?.[1];
  return id ? decodeURIComponent(id) : undefined;
}

/** Mise aux enchères d'un exemplaire, par le site ou par le script. */
export function readAuctionCreation(request: NetRequest): { userCardId: string } | undefined {
  if (request.method !== 'POST' || request.url.pathname !== AUCTIONS) return undefined;
  const body = parseJson(request.body ?? '');
  const userCardId = isRecord(body) ? body.card_id : undefined;
  return typeof userCardId === 'string' ? { userCardId } : undefined;
}

/** Annonce retirée. */
export function readAuctionCancel(request: NetRequest): { auctionId: string } | undefined {
  if (request.method !== 'DELETE') return undefined;
  const auctionId = auctionIdOf(request);
  return auctionId ? { auctionId } : undefined;
}

/** Identifiant de l'enchère demandée, si c'est la requête de sa page (pas `mine` ni une autre route du marché). */
export function readAuctionRequest(request: NetRequest): string | undefined {
  if (request.method !== 'GET') return undefined;
  const auctionId = auctionIdOf(request);
  return auctionId && UUID.test(auctionId) ? auctionId : undefined;
}

/**
 * La carte (modèle) mise aux enchères, dans la réponse de sa page :
 * `{ auction: { card_id, snapshot_rarity, card: { id, wikipedia_title, rarity, … }, … }, bids }` (capture du 30/09/2026).
 * Rareté : celle de l'exemplaire mis en vente (`snapshot_rarity`), sinon celle de la carte aujourd'hui.
 */
export function parseAuctionCard(body: unknown): CardRef | undefined {
  const auction = isRecord(body) ? body.auction : undefined;
  const card = isRecord(auction) ? parseCardRef(auction.card) : undefined;
  if (!isRecord(auction) || !card) return undefined;
  return { ...card, rarity: parseRarity(auction.snapshot_rarity) ?? card.rarity };
}
