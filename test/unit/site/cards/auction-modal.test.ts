import { describe, expect, it } from 'vitest';
import { parseDuration } from '@/site/cards';

describe('parseDuration', () => {
  it('lit les durées proposées par le site, en minutes', () => {
    expect(['10 min', '30 min', '1 h', '3 h', '6 h', '12 h'].map(parseDuration)).toEqual([10, 30, 60, 180, 360, 720]);
    expect(parseDuration('2 j')).toBe(2880);
    expect(parseDuration('24h')).toBe(1440);
  });

  it('ignore tout autre texte', () => {
    expect(parseDuration('Annuler')).toBeUndefined();
    expect(parseDuration('10')).toBeUndefined();
    expect(parseDuration("Lancer l'enchère")).toBeUndefined();
  });
});
