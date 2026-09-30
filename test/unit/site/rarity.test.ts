import { describe, expect, it } from 'vitest';
import { parseRarity } from '@/site/rarity';

describe('raretés', () => {
  it('reconnaît les raretés du site, quelle que soit la casse', () => {
    expect(parseRarity('UR')).toBe('UR');
    expect(parseRarity(' pc ')).toBe('PC');
    expect(parseRarity('X')).toBeUndefined();
    expect(parseRarity(3)).toBeUndefined();
  });
});
