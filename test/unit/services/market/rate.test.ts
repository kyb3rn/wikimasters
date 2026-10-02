import { describe, expect, it } from 'vitest';
import { countRequest, markRefused, rateAt, type RateRecord } from '@/services/market/rate';

/** 12:mm:ss (heure du serveur) le 02/10/2026. */
const at = (minute: number, second = 0) => Date.UTC(2026, 9, 2, 12, minute, second);
const minuteOf = (time: number) => Math.floor(time / 60_000);
const EMPTY: RateRecord = { minute: 0, count: 0, blocked: false };

describe('compteur des historiques', () => {
  it('compte par minute de l’horloge du serveur, remis à zéro à hh:mm:00', () => {
    let record = EMPTY;
    for (const second of [0, 10, 59]) record = countRequest(record, at(37, second));
    expect(rateAt(record, at(37, 59))).toEqual({ count: 3, blocked: false, resetsAt: at(38) });
    record = countRequest(record, at(38, 1));
    expect(rateAt(record, at(38, 1))).toEqual({ count: 1, blocked: false, resetsAt: at(39) });
  });

  it('minute écoulée sans requête : zéro', () => {
    const record = countRequest(EMPTY, at(37, 30));
    expect(rateAt(record, at(38, 5))).toEqual({ count: 0, blocked: false, resetsAt: at(39) });
  });

  it('refus du site : minute pleine, jusqu’à la suivante', () => {
    let record = countRequest(EMPTY, at(37, 28));
    record = markRefused(record, at(37, 29));
    expect(rateAt(record, at(37, 56))).toEqual({ count: 1, blocked: true, resetsAt: at(38) });
    expect(rateAt(countRequest(record, at(38, 0)), at(38, 0))).toEqual({ count: 1, blocked: false, resetsAt: at(39) });
  });

  it('requête ou refus d’une minute déjà passée (réponse en retard, autre onglet) : rien ne change', () => {
    const record = countRequest(EMPTY, at(38, 2));
    expect(countRequest(record, at(37, 59))).toBe(record);
    expect(markRefused(record, at(37, 59))).toBe(record);
    expect(markRefused(EMPTY, at(37, 59))).toEqual({ minute: minuteOf(at(37)), count: 0, blocked: true });
  });
});
