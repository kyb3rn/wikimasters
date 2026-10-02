import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { SiteApiError } from './errors';
import { supabaseRequest, supabaseUserId } from './supabase';

/**
 * Ajout ou retrait d'une carte de la liste de souhaits, fait par le site en direct sur Supabase (code du site) :
 * `POST /rest/v1/wishlist_items` `{ user_id, card_id }`, `DELETE /rest/v1/wishlist_items?user_id=eq.…&card_id=eq.…`.
 */
export function isWishlistChange(request: NetRequest): boolean {
  return request.url.pathname === '/rest/v1/wishlist_items' && (request.method === 'POST' || request.method === 'DELETE');
}

export interface WishlistChange {
  readonly cardId: string;
  /** Vrai pour un ajout, faux pour un retrait. */
  readonly wished: boolean;
}

/** Carte ajoutée ou retirée par une requête `isWishlistChange` ; `undefined` si la requête ne se lit pas. */
export function readWishlistChange(request: NetRequest): WishlistChange | undefined {
  if (!isWishlistChange(request)) return undefined;
  if (request.method === 'DELETE') {
    const cardId = /^eq\.(.+)$/.exec(request.url.searchParams.get('card_id') ?? '')?.[1];
    return cardId ? { cardId, wished: false } : undefined;
  }
  const body = request.body === undefined ? undefined : parseJson(request.body);
  return isRecord(body) && typeof body.card_id === 'string' ? { cardId: body.card_id, wished: true } : undefined;
}

function sessionUser(): string {
  const userId = supabaseUserId();
  if (!userId) throw new SiteApiError('Session du site introuvable : rechargez la page.', 0);
  return userId;
}

/** Retire la carte (modèle) de ma liste de souhaits, comme le bouton de la modale du site. */
export async function removeFromWishlist(cardId: string): Promise<void> {
  const user = encodeURIComponent(sessionUser());
  await supabaseRequest(
    `/rest/v1/wishlist_items?user_id=eq.${user}&card_id=eq.${encodeURIComponent(cardId)}`,
    { method: 'DELETE' },
    'Impossible de retirer la carte de la liste de souhaits',
    () => true,
  );
}

/** Ajoute la carte (modèle) à ma liste de souhaits, comme le site ; déjà présente (`23505`) : rien à faire, comme lui. */
export async function addToWishlist(cardId: string): Promise<void> {
  try {
    await supabaseRequest(
      '/rest/v1/wishlist_items',
      { method: 'POST', body: JSON.stringify({ user_id: sessionUser(), card_id: cardId }) },
      "Impossible d'ajouter la carte à la liste de souhaits",
      () => true,
    );
  } catch (error) {
    if (!(error instanceof SiteApiError) || error.code !== '23505') throw error;
  }
}
