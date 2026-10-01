import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';

/**
 * Actions du site sur les exemplaires faites en direct sur Supabase, lues dans ses requêtes (code du site,
 * 29/09/2026) ; la défausse et la mise aux enchères passent par ses routes (`site/api`) :
 * - favori : `PATCH SB /rest/v1/user_cards?user_id=eq.<uid>&card_id=eq.<carte>` `{ starred }`,
 *   appliqué à tous les exemplaires de la carte ;
 * - étiquette ajoutée : `POST SB /rest/v1/user_card_tags` `{ user_card_id, tag_id }` ;
 * - étiquette retirée : `DELETE SB /rest/v1/user_card_tags?user_card_id=eq.<exemplaire>&tag_id=eq.<étiquette>`.
 */

function eqParam(request: NetRequest, name: string): string | undefined {
  const value = request.url.searchParams.get(name);
  return value?.startsWith('eq.') ? value.slice(3) : undefined;
}

function jsonBody(request: NetRequest): Record<string, unknown> | undefined {
  const body = parseJson(request.body ?? '');
  return isRecord(body) ? body : undefined;
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
