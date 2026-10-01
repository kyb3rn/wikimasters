import { describe, expect, it } from 'vitest';
import { formatCountdown, midnightAfter, nextMidnight } from '@/features/pulls-pro/time';

describe('nextMidnight', () => {
  it('minuit suivant, heure française (été : UTC+2)', () => {
    expect(nextMidnight(Date.parse('2026-09-30T00:09:39+02:00'))).toBe(Date.parse('2026-10-01T00:00:00+02:00'));
    expect(nextMidnight(Date.parse('2026-09-30T23:59:59+02:00'))).toBe(Date.parse('2026-10-01T00:00:00+02:00'));
  });

  it('à minuit pile : le minuit du lendemain', () => {
    expect(nextMidnight(Date.parse('2026-10-01T00:00:00+02:00'))).toBe(Date.parse('2026-10-02T00:00:00+02:00'));
  });

  it("jours de changement d'heure : 25 h le 25 octobre, 23 h le 29 mars", () => {
    expect(nextMidnight(Date.parse('2026-10-25T01:00:00+02:00'))).toBe(Date.parse('2026-10-26T00:00:00+01:00'));
    expect(nextMidnight(Date.parse('2026-10-24T20:00:00+02:00'))).toBe(Date.parse('2026-10-25T00:00:00+02:00'));
    expect(nextMidnight(Date.parse('2026-03-29T01:30:00+01:00'))).toBe(Date.parse('2026-03-30T00:00:00+02:00'));
  });

  it("quel que soit le fuseau du PC : l'heure française", () => {
    expect(nextMidnight(Date.parse('2026-09-30T20:00:00-04:00'))).toBe(Date.parse('2026-10-02T00:00:00+02:00'));
  });
});

describe('midnightAfter', () => {
  it('minuit qui termine ce jour, heure française', () => {
    expect(midnightAfter('2026-09-30')).toBe(Date.parse('2026-10-01T00:00:00+02:00'));
    expect(midnightAfter('2026-10-25')).toBe(Date.parse('2026-10-26T00:00:00+01:00'));
    expect(midnightAfter('2026-12-31')).toBe(Date.parse('2027-01-01T00:00:00+01:00'));
  });
});

describe('formatCountdown', () => {
  it('heures, minutes, secondes sur deux chiffres', () => {
    expect(formatCountdown((4 * 3600 + 31 * 60 + 54) * 1000)).toBe('04:31:54');
    expect(formatCountdown(59_000)).toBe('00:00:59');
    expect(formatCountdown(24 * 3600 * 1000)).toBe('24:00:00');
  });

  it("seconde entamée comptée : 00:00:00 seulement à l'heure", () => {
    expect(formatCountdown(400)).toBe('00:00:01');
    expect(formatCountdown(0)).toBe('00:00:00');
    expect(formatCountdown(-5000)).toBe('00:00:00');
  });
});
