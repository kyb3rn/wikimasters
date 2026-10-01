import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { onServerSecond, serverOffset } from '@/site/clock';

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
