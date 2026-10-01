import { describe, expect, it } from 'vitest';
import { formatPreciseRemaining, formatShortRemaining, remainingState } from '@/services/market-tile/time';

const s = (seconds: number) => seconds * 1000;
const hms = (h: number, m: number, sec: number) => s(h * 3600 + m * 60 + sec);

describe('temps restant de la carte standardisée du marché', () => {
  it('court : l’unité la plus grande seule, « Terminée » à zéro', () => {
    expect(formatShortRemaining(hms(3, 0, 0))).toBe('3h');
    expect(formatShortRemaining(hms(2, 7, 28))).toBe('2h');
    expect(formatShortRemaining(hms(1, 0, 0))).toBe('1h');
    expect(formatShortRemaining(hms(0, 59, 59))).toBe('59min');
    expect(formatShortRemaining(hms(0, 15, 0))).toBe('15min');
    expect(formatShortRemaining(hms(0, 1, 0))).toBe('1min');
    expect(formatShortRemaining(s(59))).toBe('59s');
    expect(formatShortRemaining(s(1))).toBe('1s');
    expect(formatShortRemaining(0)).toBe('Terminée');
    expect(formatShortRemaining(-5000)).toBe('Terminée');
    expect(formatShortRemaining(hms(27, 0, 0))).toBe('27h');
  });

  it('une fraction de seconde compte encore pour une seconde', () => {
    expect(formatShortRemaining(400)).toBe('1s');
    expect(formatShortRemaining(s(59) + 500)).toBe('1min');
  });

  it('précis, au survol : « 2:07:28 », « 00:07:46 », « 00:00:09 »', () => {
    expect(formatPreciseRemaining(hms(2, 7, 28))).toBe('2:07:28');
    expect(formatPreciseRemaining(hms(12, 0, 5))).toBe('12:00:05');
    expect(formatPreciseRemaining(hms(0, 7, 46))).toBe('00:07:46');
    expect(formatPreciseRemaining(s(9))).toBe('00:00:09');
    expect(formatPreciseRemaining(0)).toBe('Terminée');
  });

  it('états : en cours, moins de 5 minutes, terminée', () => {
    expect(remainingState(hms(0, 5, 0))).toBe('running');
    expect(remainingState(hms(0, 4, 59))).toBe('soon');
    expect(remainingState(0)).toBe('ended');
  });
});
