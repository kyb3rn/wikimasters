import { describe, expect, it } from 'vitest';
import { copiesByCard, isCopiesQuery, isPackOpening, parsePack, type OwnedCopy, type PackCard } from '@/site/pulls';
import { netRequest } from '../../support';

const card = (id: string, isShiny = false): PackCard => ({ id, title: `Carte ${id}`, rarity: 'C', isShiny });
const copy = (id: string, cardId: string, isShiny = false): OwnedCopy => ({ id, cardId, starred: false, isShiny, tags: 0 });

describe('paquet ouvert', () => {
  it('reconnaît les ouvertures (classique et PRO du jour) et la requête des exemplaires', () => {
    expect(isPackOpening(netRequest('/api/packs/open', { method: 'POST' }))).toBe(true);
    expect(isPackOpening(netRequest('/api/packs/pro-daily', { method: 'POST' }))).toBe(true);
    expect(isPackOpening(netRequest('/api/packs/verify-human', { method: 'POST' }))).toBe(false);
    expect(isPackOpening(netRequest('/api/packs/open'))).toBe(false);
    expect(
      isCopiesQuery(netRequest('https://x.supabase.co/rest/v1/user_cards?select=id,card_id&user_id=eq.u1&card_id=in.(c1,c2)')),
    ).toBe(true);
    expect(isCopiesQuery(netRequest('https://x.supabase.co/rest/v1/user_cards?select=id&user_id=eq.u1'))).toBe(false);
  });

  it('lit les cartes et les exemplaires de la réponse d’ouverture', () => {
    const pack = parsePack({
      cards: [
        { id: 'c1', wikipedia_title: 'Paris', rarity: 'R' },
        { id: 'c2', wikipedia_title: 'Lyon', rarity: 'L', is_shiny: true },
      ],
      packs_remaining: 3,
      owned_copies: [
        { id: 'u1', card_id: 'c1', starred: false, is_shiny: false, user_card_tags: [] },
        { id: 'u2', card_id: 'c2', starred: true, is_shiny: true, user_card_tags: [{ tag: { id: 't1' } }, { tag: null }] },
        { pas: 'un exemplaire' },
      ],
    });
    expect(pack).toEqual({
      cards: [
        { id: 'c1', title: 'Paris', rarity: 'R', isShiny: false },
        { id: 'c2', title: 'Lyon', rarity: 'L', isShiny: true },
      ],
      copies: [
        { id: 'u1', cardId: 'c1', starred: false, isShiny: false, tags: 0 },
        { id: 'u2', cardId: 'c2', starred: true, isShiny: true, tags: 1 },
      ],
    });
  });

  it('note l’absence d’exemplaires (paquet PRO) et refuse une réponse sans cartes', () => {
    expect(parsePack({ cards: [{ id: 'c1' }] })?.copies).toBeNull();
    expect(parsePack({ cards: [] })).toBeUndefined();
    expect(parsePack({ cards: [{ titre: 'sans id' }] })).toBeUndefined();
    expect(parsePack('erreur')).toBeUndefined();
  });

  it('associe à chaque carte l’exemplaire que choisit le site', () => {
    const cards = [card('c1'), card('c2', true), card('c3')];
    const copies = [
      copy('u1', 'c1'),
      copy('u1b', 'c1'), // plusieurs exemplaires : le premier
      copy('u2-normal', 'c2'), // carte tirée shiny : l'exemplaire shiny l'emporte…
      copy('u2-shiny', 'c2', true),
      copy('u3-shiny', 'c3', true), // …et à défaut d'exemplaire du bon état, le premier
    ];
    expect(Object.fromEntries(copiesByCard(cards, copies))).toEqual({ c1: 'u1', c2: 'u2-shiny', c3: 'u3-shiny' });
  });
});
