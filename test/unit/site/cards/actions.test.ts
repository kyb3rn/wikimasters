import { describe, expect, it } from 'vitest';
import { readStarChange, readTagAdded, readTagRemoved } from '@/site/cards';
import { netRequest } from '../../support';

const SB = 'https://x.supabase.co/rest/v1';

describe('actions du site sur les exemplaires', () => {
  it('lit un favori mis ou retiré sur une carte', () => {
    expect(readStarChange(netRequest(`${SB}/user_cards?user_id=eq.u1&card_id=eq.c1`, { method: 'PATCH', body: { starred: true } }))).toEqual({
      cardId: 'c1',
      starred: true,
    });
    expect(readStarChange(netRequest(`${SB}/user_cards?card_id=eq.c1`, { method: 'PATCH', body: { autre: 1 } }))).toBeUndefined();
    expect(readStarChange(netRequest(`${SB}/user_cards?card_id=eq.c1`))).toBeUndefined();
  });

  it('lit une étiquette ajoutée ou retirée', () => {
    expect(readTagAdded(netRequest(`${SB}/user_card_tags`, { method: 'POST', body: { user_card_id: 'u1', tag_id: 't1' } }))).toEqual({
      userCardId: 'u1',
    });
    expect(readTagRemoved(netRequest(`${SB}/user_card_tags?user_card_id=eq.u1&tag_id=eq.t1`, { method: 'DELETE' }))).toEqual({
      userCardId: 'u1',
    });
    expect(readTagAdded(netRequest(`${SB}/tags`, { method: 'POST', body: { name: 'x' } }))).toBeUndefined();
  });
});
