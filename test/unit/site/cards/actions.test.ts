import { describe, expect, it } from 'vitest';
import type { NetRequest } from '@/core/net';
import { readAuctionCreation, readDiscard, readStarChange, readTagAdded, readTagRemoved } from '@/site/cards';

function request(method: string, url: string, body?: unknown): NetRequest {
  return {
    url: new URL(url),
    method,
    headers: new Headers(),
    body: body === undefined ? undefined : JSON.stringify(body),
    own: false,
  };
}

const SB = 'https://x.supabase.co/rest/v1';

describe('actions du site sur les exemplaires', () => {
  it('lit un favori mis ou retiré sur une carte', () => {
    expect(readStarChange(request('PATCH', `${SB}/user_cards?user_id=eq.u1&card_id=eq.c1`, { starred: true }))).toEqual({
      cardId: 'c1',
      starred: true,
    });
    expect(readStarChange(request('PATCH', `${SB}/user_cards?card_id=eq.c1`, { autre: 1 }))).toBeUndefined();
    expect(readStarChange(request('GET', `${SB}/user_cards?card_id=eq.c1`))).toBeUndefined();
  });

  it('lit une étiquette ajoutée ou retirée', () => {
    expect(readTagAdded(request('POST', `${SB}/user_card_tags`, { user_card_id: 'u1', tag_id: 't1' }))).toEqual({
      userCardId: 'u1',
    });
    expect(readTagRemoved(request('DELETE', `${SB}/user_card_tags?user_card_id=eq.u1&tag_id=eq.t1`))).toEqual({
      userCardId: 'u1',
    });
    expect(readTagAdded(request('POST', `${SB}/tags`, { name: 'x' }))).toBeUndefined();
  });

  it('lit une mise aux enchères (le champ card_id porte l’exemplaire)', () => {
    const create = request('POST', 'https://www.wiki-masters.com/api/marketplace', {
      card_id: 'u1',
      base_amount: 90,
      duration_minutes: 10,
    });
    expect(readAuctionCreation(create)).toEqual({ userCardId: 'u1' });
    expect(readAuctionCreation(request('POST', 'https://www.wiki-masters.com/api/marketplace/a1/bid', { amount: 5 }))).toBeUndefined();
    expect(readAuctionCreation(request('GET', 'https://www.wiki-masters.com/api/marketplace?page=1'))).toBeUndefined();
  });

  it('lit une défausse', () => {
    expect(readDiscard(request('POST', 'https://www.wiki-masters.com/api/user-cards/u%201/discard'))).toEqual({
      userCardId: 'u 1',
    });
    expect(readDiscard(request('GET', 'https://www.wiki-masters.com/api/user-cards/u1/discard'))).toBeUndefined();
  });
});
