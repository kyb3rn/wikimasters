import { describe, expect, it } from 'vitest';
import { notificationAge } from '@/features/notifications/age';

const NOW = Date.parse('2026-09-30T12:00:00Z');
const ago = (ms: number) => notificationAge(NOW - ms, NOW);
const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

describe('âge des notifications', () => {
  it("dit « À l'instant » la première minute, et pour une date dans le futur (horloge du PC en retard)", () => {
    expect(ago(0)).toBe("À l'instant");
    expect(ago(59_000)).toBe("À l'instant");
    expect(ago(-5 * MIN)).toBe("À l'instant");
  });

  it('arrondit vers le bas, de la minute aux années', () => {
    expect(ago(MIN)).toBe('Il y a 1 min');
    expect(ago(59 * MIN + 59_000)).toBe('Il y a 59 min');
    expect(ago(HOUR)).toBe('Il y a 1 h');
    expect(ago(23 * HOUR + 59 * MIN)).toBe('Il y a 23 h');
    expect(ago(DAY)).toBe('Il y a 1 j');
    expect(ago(6 * DAY)).toBe('Il y a 6 j');
    expect(ago(7 * DAY)).toBe('Il y a 1 sem.');
    expect(ago(29 * DAY)).toBe('Il y a 4 sem.');
    expect(ago(30 * DAY)).toBe('Il y a 1 mois');
    expect(ago(364 * DAY)).toBe('Il y a 12 mois');
    expect(ago(365 * DAY)).toBe('Il y a 1 an');
    expect(ago(800 * DAY)).toBe('Il y a 2 ans');
  });
});
