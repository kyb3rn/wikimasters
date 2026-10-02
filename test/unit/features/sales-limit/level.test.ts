import { describe, expect, it } from 'vitest';
import { rateLevel, secondsLeft } from '@/features/sales-limit/level';

const rate = (count: number, blocked = false) => ({ count, blocked, resetsAt: 60_000 });

describe('niveau du compteur', () => {
  it('vert, orange dès 20, rouge dès 25 ou après un refus', () => {
    expect(rateLevel(rate(0))).toBe('ok');
    expect(rateLevel(rate(19))).toBe('ok');
    expect(rateLevel(rate(20))).toBe('warn');
    expect(rateLevel(rate(24))).toBe('warn');
    expect(rateLevel(rate(25))).toBe('danger');
    expect(rateLevel(rate(3, true))).toBe('danger');
  });

  it('secondes avant la remise à zéro : arrondies au-dessus, de 1 à 60', () => {
    expect(secondsLeft(rate(0), 0)).toBe(60);
    expect(secondsLeft(rate(0), 17_010)).toBe(43);
    expect(secondsLeft(rate(0), 59_999)).toBe(1);
    expect(secondsLeft(rate(0), 60_000)).toBe(1);
  });
});
