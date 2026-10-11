import { describe, expect, it } from 'vitest';
import { readWishlistChanges } from '@/site/api';
import { netRequest } from '../../support';

const SUPABASE = 'https://x.supabase.co/rest/v1/wishlist_items';

describe('liste de souhaits', () => {
  it('lit la carte ajoutée ou retirée par la modale de carte', () => {
    expect(readWishlistChanges(netRequest(SUPABASE, { method: 'POST', body: { user_id: 'u0', card_id: 'c1' } }))).toEqual([
      { cardId: 'c1', wished: true },
    ]);
    expect(readWishlistChanges(netRequest(`${SUPABASE}?user_id=eq.u0&card_id=eq.c1`, { method: 'DELETE' }))).toEqual([
      { cardId: 'c1', wished: false },
    ]);
  });

  it('lit les cartes ajoutées ou retirées par la sélection de Toutes les cartes', () => {
    const body = [
      { user_id: 'u0', card_id: 'c1' },
      { user_id: 'u0', card_id: 'c2' },
    ];
    expect(readWishlistChanges(netRequest(`${SUPABASE}?on_conflict=user_id%2Ccard_id`, { method: 'POST', body }))).toEqual([
      { cardId: 'c1', wished: true },
      { cardId: 'c2', wished: true },
    ]);
    const ids = encodeURIComponent('in.(c1,"c,2",c3)');
    expect(readWishlistChanges(netRequest(`${SUPABASE}?user_id=eq.u0&card_id=${ids}`, { method: 'DELETE' }))).toEqual([
      { cardId: 'c1', wished: false },
      { cardId: 'c,2', wished: false },
      { cardId: 'c3', wished: false },
    ]);
  });

  it('rien pour une lecture ou une requête illisible', () => {
    expect(readWishlistChanges(netRequest(`${SUPABASE}?select=card_id&user_id=eq.u0`))).toEqual([]);
    expect(readWishlistChanges(netRequest(SUPABASE, { method: 'POST', body: 'pas du json' }))).toEqual([]);
    expect(readWishlistChanges(netRequest(SUPABASE, { method: 'DELETE' }))).toEqual([]);
  });
});
