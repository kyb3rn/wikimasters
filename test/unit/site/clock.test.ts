import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { narrowOffset, onServerSecond, serverOffset } from '@/site/clock';

describe('serverOffset', () => {
  const at = Date.parse('2026-09-29T22:09:36.670Z');
  const headers = (init: Record<string, string>) => new Headers(init);

  it("avance du serveur d'après l'en-tête Date", () => {
    expect(serverOffset(headers({ date: 'Tue, 29 Sep 2026 23:09:37 GMT' }), at)).toBe(3600_000 + 830);
    expect(serverOffset(headers({ date: 'Tue, 29 Sep 2026 22:04:36 GMT' }), at)).toBe(-300_000 - 170);
  });

  it('écart de moins de 2 s : horloges d’accord (en-tête à la seconde près)', () => {
    expect(serverOffset(headers({ date: 'Tue, 29 Sep 2026 22:09:37 GMT' }), at)).toBe(0);
  });

  it('sans date, ou réponse sortie d’un cache : rien', () => {
    expect(serverOffset(headers({}), at)).toBeUndefined();
    expect(serverOffset(headers({ date: 'Tue, 29 Sep 2026 22:08:42 GMT', age: '419040' }), at)).toBeUndefined();
  });
});

describe('narrowOffset', () => {
  // Serveur en avance de 1,8 s sur le PC (capture du 02/10/2026).
  const SKEW = 1800;
  /** Réponse partie à `start` (heure du PC), reçue `ms` plus tard, écrite par le serveur au milieu du trajet. */
  const reply = (start: number, ms: number) => {
    const written = start + ms / 2 + SKEW;
    return [new Headers({ date: new Date(written - (written % 1000)).toUTCString() }), start, start + ms] as const;
  };

  it('une réponse : avance entre date − réception et date + 1 s − départ', () => {
    const [headers, start, end] = reply(Date.parse('2026-10-02T06:23:00.000Z'), 300);
    expect(narrowOffset(undefined, headers, start, end)).toEqual({ low: 1000 - 300, high: 2000 });
  });

  it('recoupées sur plusieurs réponses : l’avance à quelques centaines de ms près, écart de moins de 2 s compris', () => {
    let bounds: ReturnType<typeof narrowOffset>;
    for (let index = 0; index < 20; index++) bounds = narrowOffset(bounds, ...reply(Date.parse('2026-10-02T06:23:00.000Z') + index * 1370, 250));
    expect(bounds).toBeDefined();
    if (!bounds) return;
    expect(bounds.low).toBeLessThanOrEqual(SKEW);
    expect(bounds.high).toBeGreaterThanOrEqual(SKEW);
    expect(bounds.high - bounds.low).toBeLessThan(400);
  });

  it('sans date ou sortie d’un cache : bornes inchangées ; plus de recouvrement (horloge du PC changée) : la dernière', () => {
    const bounds = { low: 1700, high: 1900 };
    expect(narrowOffset(bounds, new Headers(), 0, 100)).toBe(bounds);
    expect(narrowOffset(bounds, new Headers({ date: 'Fri, 02 Oct 2026 06:23:00 GMT', age: '30' }), 0, 100)).toBe(bounds);
    // Horloge du PC avancée d'une minute.
    const [headers, start, end] = reply(Date.parse('2026-10-02T06:23:00.000Z'), 200);
    expect(narrowOffset(bounds, headers, start + 60_000, end + 60_000)).toEqual({ low: 1000 - 200 - 60_000, high: 2000 - 60_000 });
  });
});

describe('onServerSecond', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.setSystemTime(Date.parse('2026-10-01T10:00:00.400Z'));
  });
  afterEach(() => vi.useRealTimers());

  it('une seule minuterie, calée sur le changement de seconde, pour tous les abonnés', () => {
    const first = vi.fn();
    const second = vi.fn();
    const controller = new AbortController();
    onServerSecond(first, { signal: controller.signal });
    onServerSecond(second, { signal: controller.signal });
    expect(vi.getTimerCount()).toBe(1);

    vi.advanceTimersByTime(600);
    expect(first).not.toHaveBeenCalled();
    vi.advanceTimersByTime(10);
    expect(first).toHaveBeenCalledTimes(1);
    expect(second).toHaveBeenCalledTimes(1);
    vi.advanceTimersByTime(1000);
    expect(first).toHaveBeenCalledTimes(2);
    controller.abort();
  });

  it('désabonné à l’interruption ; plus aucun abonné : minuterie arrêtée', () => {
    const kept = vi.fn();
    const gone = vi.fn();
    const keep = new AbortController();
    const leave = new AbortController();
    onServerSecond(kept, { signal: keep.signal });
    onServerSecond(gone, { signal: leave.signal });
    leave.abort();
    vi.advanceTimersByTime(1000);
    expect(kept).toHaveBeenCalledTimes(1);
    expect(gone).not.toHaveBeenCalled();

    keep.abort();
    expect(vi.getTimerCount()).toBe(0);
    onServerSecond(gone, { signal: AbortSignal.abort() });
    expect(vi.getTimerCount()).toBe(0);
  });
});
