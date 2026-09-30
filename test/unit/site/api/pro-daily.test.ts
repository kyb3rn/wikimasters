import { describe, expect, it } from 'vitest';
import { claimDateOf, parseProDaily } from '@/site/api';

describe('parseProDaily', () => {
  it('disponibilité et jour dont parle la réponse (présent même pack disponible)', () => {
    expect(parseProDaily({ eligible: false, claimed_today: true, claim_date: '2026-09-30' })).toEqual({
      eligible: false,
      claimedToday: true,
      claimDate: '2026-09-30',
    });
    expect(parseProDaily({ eligible: true, claimed_today: false, claim_date: '2026-09-30' })).toEqual({
      eligible: true,
      claimedToday: false,
      claimDate: '2026-09-30',
    });
    expect(parseProDaily({ eligible: true })).toEqual({ eligible: true, claimedToday: false, claimDate: undefined });
  });

  it('réponse sans aucun des deux : rejetée', () => {
    expect(parseProDaily({ error: 'Erreur' })).toBeUndefined();
    expect(parseProDaily(null)).toBeUndefined();
  });
});

describe('claimDateOf', () => {
  it('jour au format AAAA-MM-JJ seulement (refus 409 compris)', () => {
    expect(claimDateOf({ error: 'Déjà réclamé', claim_date: '2026-09-30' })).toBe('2026-09-30');
    expect(claimDateOf({ claim_date: '30/09/2026' })).toBeUndefined();
    expect(claimDateOf({ cards: [] })).toBeUndefined();
  });
});
