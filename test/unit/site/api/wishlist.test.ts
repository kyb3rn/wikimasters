import { describe, expect, it } from 'vitest';
import { readWishlistChange } from '@/site/api';
import { netRequest } from '../../support';

const SUPABASE = 'https://x.supabase.co/rest/v1/wishlist_items';

describe('liste de souhaits', () => {
  it('lit la carte ajoutée ou retirée par le site', () => {
    expect(readWishlistChange(netRequest(SUPABASE, { method: 'POST', body: { user_id: 'u0', card_id: 'c1' } }))).toEqual({
      cardId: 'c1',
      wished: true,
    });
    expect(readWishlistChange(netRequest(`${SUPABASE}?user_id=eq.u0&card_id=eq.c1`, { method: 'DELETE' }))).toEqual({
      cardId: 'c1',
      wished: false,
    });
    expect(readWishlistChange(netRequest(`${SUPABASE}?select=card_id&user_id=eq.u0`))).toBeUndefined();
    expect(readWishlistChange(netRequest(SUPABASE, { method: 'POST', body: 'pas du json' }))).toBeUndefined();
    expect(readWishlistChange(netRequest(SUPABASE, { method: 'DELETE' }))).toBeUndefined();
  });
});
