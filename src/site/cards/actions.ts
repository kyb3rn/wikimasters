import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';

/**
 * Actions du site sur les exemplaires, lues dans ses requêtes (relevé le 29/09/2026, code du site) :
 * - favori : `PATCH SB /rest/v1/user_cards?user_id=eq.<uid>&card_id=eq.<carte>` `{ starred }`,
 *   appliqué à tous les exemplaires de la carte ;
 * - étiquette ajoutée : `POST SB /rest/v1/user_card_tags` `{ user_card_id, tag_id }` ;
 * - étiquette retirée : `DELETE SB /rest/v1/user_card_tags?user_card_id=eq.<exemplaire>&tag_id=eq.<étiquette>` ;
 * - défausse : `POST /api/user-cards/<exemplaire>/discard`.
 */

function eqParam(request: NetRequest, name: string): string | undefined {
  const value = request.url.searchParams.get(name);
  return value?.startsWith('eq.') ? value.slice(3) : undefined;
}

function jsonBody(request: NetRequest): Record<string, unknown> | undefined {
  if (request.body === undefined) return undefined;
  try {
    const parsed: unknown = JSON.parse(request.body);
    return isRecord(parsed) ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Favori mis ou retiré sur une carte (tous ses exemplaires). */
export function readStarChange(request: NetRequest): { cardId: string; starred: boolean } | undefined {
  if (request.method !== 'PATCH' || !request.url.pathname.endsWith('/rest/v1/user_cards')) return undefined;
  const cardId = eqParam(request, 'card_id');
  const starred = jsonBody(request)?.starred;
  return cardId && typeof starred === 'boolean' ? { cardId, starred } : undefined;
}

/** Étiquette ajoutée à un exemplaire. */
export function readTagAdded(request: NetRequest): { userCardId: string } | undefined {
  if (request.method !== 'POST' || !request.url.pathname.endsWith('/rest/v1/user_card_tags')) return undefined;
  const userCardId = jsonBody(request)?.user_card_id;
  return typeof userCardId === 'string' ? { userCardId } : undefined;
}

/** Étiquette retirée d'un exemplaire. */
export function readTagRemoved(request: NetRequest): { userCardId: string } | undefined {
  if (request.method !== 'DELETE' || !request.url.pathname.endsWith('/rest/v1/user_card_tags')) return undefined;
  const userCardId = eqParam(request, 'user_card_id');
  return userCardId ? { userCardId } : undefined;
}

/** Mise aux enchères d'un exemplaire : `POST /api/marketplace` `{ card_id: <exemplaire>, base_amount, duration_minutes }`. */
export function readAuctionCreation(request: NetRequest): { userCardId: string } | undefined {
  if (request.method !== 'POST' || request.url.pathname !== '/api/marketplace') return undefined;
  const userCardId = jsonBody(request)?.card_id;
  return typeof userCardId === 'string' ? { userCardId } : undefined;
}

/** Annonce retirée : `DELETE /api/marketplace/<id>` (l'exemplaire revient dans la collection). */
export function readAuctionCancel(request: NetRequest): { auctionId: string } | undefined {
  if (request.method !== 'DELETE') return undefined;
  const match = /^\/api\/marketplace\/([^/]+)$/.exec(request.url.pathname);
  return match?.[1] ? { auctionId: decodeURIComponent(match[1]) } : undefined;
}

/** Exemplaire défaussé (par le site ou par le script). */
export function readDiscard(request: NetRequest): { userCardId: string } | undefined {
  if (request.method !== 'POST') return undefined;
  const match = /^\/api\/user-cards\/([^/]+)\/discard$/.exec(request.url.pathname);
  return match?.[1] ? { userCardId: decodeURIComponent(match[1]) } : undefined;
}
