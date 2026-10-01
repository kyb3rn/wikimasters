import { describe, expect, it } from 'vitest';
import { parseTradeWikibidous } from '@/site/trades';

describe('parseTradeWikibidous', () => {
  it('comme le champ du site : entier, espaces ignorés, plafonné à 10 000', () => {
    expect(parseTradeWikibidous('250')).toBe(250);
    expect(parseTradeWikibidous('1 500')).toBe(1500);
    expect(parseTradeWikibidous('12.9')).toBe(12);
    expect(parseTradeWikibidous('25000')).toBe(10_000);
  });

  it('vide, négatif ou illisible : 0', () => {
    expect(parseTradeWikibidous('')).toBe(0);
    expect(parseTradeWikibidous('-5')).toBe(0);
    expect(parseTradeWikibidous('abc')).toBe(0);
  });
});
