import { describe, expect, it } from 'vitest';
import { ageText, plural, round1, shortDate } from '@/services/market/format';

describe('textes du marché', () => {
  it('âge d’un chargement, à l’unité la plus grande ; horloge en arrière : à l’instant', () => {
    const now = Date.parse('2026-09-30T12:00:00Z');
    expect(ageText(now - 59_000, now)).toBe("à l'instant");
    expect(ageText(now + 5_000, now)).toBe("à l'instant");
    expect(ageText(now - 5 * 60_000, now)).toBe('il y a 5 min');
    expect(ageText(now - 3 * 3_600_000, now)).toBe('il y a 3 h');
    expect(ageText(now - 2 * 86_400_000, now)).toBe('il y a 2 j');
  });

  it('pluriel au-delà de 1, dixième, jour et mois', () => {
    expect([plural(0, 'vente'), plural(1, 'vente'), plural(2, 'vente')]).toEqual(['0 vente', '1 vente', '2 ventes']);
    expect(round1(12.345)).toBe(12.3);
    expect(shortDate(new Date(2026, 8, 29, 23, 0).getTime())).toBe('29/09');
  });
});
