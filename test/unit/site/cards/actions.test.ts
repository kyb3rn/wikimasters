import { describe, expect, it } from 'vitest';
import { readStarChange, readTagAdded, readTagRemoved } from '@/site/cards';
import { netRequest } from '../../support';

const SB = 'https://x.supabase.co/rest/v1';

describe('actions du site sur les exemplaires', () => {
  it('lit un favori mis ou retiré sur des exemplaires', () => {
    const patch = (query: string, body: unknown) => readStarChange(netRequest(`${SB}/user_cards?${query}`, { method: 'PATCH', body }));
    // Paquets, Collection, sélection de la Collection.
    expect(patch('user_id=eq.p1&id=eq.u1', { starred: true })).toEqual({ userCardIds: ['u1'], starred: true });
    expect(patch('id=eq.u1', { starred: false })).toEqual({ userCardIds: ['u1'], starred: false });
    expect(patch('user_id=eq.p1&id=in.(u1,u2)', { starred: true })).toEqual({ userCardIds: ['u1', 'u2'], starred: true });
    expect(patch('id=in.("u1","u2")', { starred: true })).toEqual({ userCardIds: ['u1', 'u2'], starred: true });
  });

  it('ignore le reste : ancien favori par carte, autre champ, autre méthode', () => {
    expect(readStarChange(netRequest(`${SB}/user_cards?user_id=eq.p1&card_id=eq.c1`, { method: 'PATCH', body: { starred: true } }))).toBeUndefined();
    expect(readStarChange(netRequest(`${SB}/user_cards?id=eq.u1`, { method: 'PATCH', body: { autre: 1 } }))).toBeUndefined();
    expect(readStarChange(netRequest(`${SB}/user_cards?id=eq.u1`))).toBeUndefined();
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
