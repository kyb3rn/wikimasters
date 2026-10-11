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

/**
 * Cartes ajoutées ou retirées par une requête `isWishlistChange` : une seule depuis la modale de carte, plusieurs
 * depuis la sélection de Toutes les cartes (`POST …?on_conflict=user_id,card_id` `[{ user_id, card_id }, …]`,
 * `DELETE …&card_id=in.(…)`). Rien si la requête ne se lit pas.
 */
export function readWishlistChanges(request: NetRequest): WishlistChange[] {
  if (!isWishlistChange(request)) return [];
  if (request.method === 'DELETE') {
    return filterValues(request.url.searchParams.get('card_id') ?? '').map((cardId) => ({ cardId, wished: false }));
  }
  const body = request.body === undefined ? undefined : parseJson(request.body);
  return (Array.isArray(body) ? body : [body]).flatMap((row: unknown) =>
    isRecord(row) && typeof row.card_id === 'string' ? [{ cardId: row.card_id, wished: true }] : [],
  );
}

/** Valeurs d'un filtre PostgREST : `eq.a`, ou `in.(a,b)` (entre guillemets, une valeur qui contient `,` ou `()`). */
function filterValues(filter: string): string[] {
  const eq = /^eq\.(.+)$/.exec(filter)?.[1];
  if (eq) return [eq];
  const list = /^in\.\((.*)\)$/.exec(filter)?.[1] ?? '';
  return [...list.matchAll(/"((?:[^"\\]|\\.)*)"|([^,]+)/g)]
    .map(([, quoted, plain]) => quoted?.replace(/\\(.)/g, '$1') ?? plain ?? '')
    .filter((value) => value !== '');
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
