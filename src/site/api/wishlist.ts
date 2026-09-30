import type { NetRequest } from '@/core/net';

/**
 * Ajout ou retrait d'une carte de la liste de souhaits, fait par le site en direct sur Supabase (code du site) :
 * `POST /rest/v1/wishlist_items` `{ user_id, card_id }`, `DELETE /rest/v1/wishlist_items?user_id=eq.…&card_id=eq.…`.
 */
export function isWishlistChange(request: NetRequest): boolean {
  return request.url.pathname === '/rest/v1/wishlist_items' && (request.method === 'POST' || request.method === 'DELETE');
}
