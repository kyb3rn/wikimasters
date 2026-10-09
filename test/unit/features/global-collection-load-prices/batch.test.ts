import { describe, expect, it } from 'vitest';
import { BATCH_LIMIT, CONCURRENCY, hasRoom, loadBatch, MAX_FAILURES, randomSpacing } from '@/features/global-collection-load-prices/batch';
import { SiteApiError } from '@/site/api';

const rate = (count: number, blocked = false) => ({ count, blocked, resetsAt: 60_000 });

/** Laisse passer les tâches en attente (promesses déjà résolues et leurs suites). */
const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

/** Demandes retenues jusqu'à `finish(item)` ; `waits` : attentes demandées entre deux départs. */
function controlled() {
  const started: string[] = [];
  const pending = new Map<string, { resolve: () => void; reject: (error: unknown) => void }>();
  const waits: number[] = [];
  return {
    started,
    waits,
    load: (item: string) =>
      new Promise<void>((resolve, reject) => {
        started.push(item);
        pending.set(item, { resolve, reject });
      }),
    wait: (ms: number) => {
      waits.push(ms);
      return Promise.resolve();
    },
    finish(item: string, error?: unknown) {
      const entry = pending.get(item);
      if (error === undefined) entry?.resolve();
      else entry?.reject(error);
    },
  };
}

const items = (count: number) => Array.from({ length: count }, (_, index) => `c${index}`);

describe('hasRoom', () => {
  it('jusqu’à 28 historiques dans la minute, rien après un refus', () => {
    expect(BATCH_LIMIT).toBe(28);
    expect(hasRoom(rate(0))).toBe(true);
    expect(hasRoom(rate(27))).toBe(true);
    expect(hasRoom(rate(28))).toBe(false);
    expect(hasRoom(rate(3, true))).toBe(false);
  });
});

describe('randomSpacing', () => {
  it('de 500 à 1000 ms, bornes comprises', () => {
    expect(randomSpacing(() => 0)).toBe(500);
    expect(randomSpacing(() => 0.5)).toBe(750);
    expect(randomSpacing(() => 0.9999999)).toBe(1000);
    for (let index = 0; index < 1000; index++) {
      const spacing = randomSpacing();
      expect(spacing).toBeGreaterThanOrEqual(500);
      expect(spacing).toBeLessThanOrEqual(1000);
    }
  });
});

describe('loadBatch', () => {
  const signal = new AbortController().signal;
  const noop = () => {};

  it('10 en cours au plus : quand une finit, la suivante part ; un écart tiré avant chaque départ sauf le premier', async () => {
    expect(CONCURRENCY).toBe(10);
    const server = controlled();
    const progress: number[] = [];
    let drawn = 0;
    const running = loadBatch(items(12), {
      load: server.load,
      wait: server.wait,
      spacing: () => 500 + 10 * ++drawn,
      room: () => true,
      signal,
      onProgress: (done) => progress.push(done),
    });
    await flush();
    expect(server.started).toEqual(items(10));
    server.finish('c3');
    await flush();
    expect(server.started).toEqual(items(11));
    expect(progress).toEqual([1]);
    for (const item of items(11)) server.finish(item);
    await flush();
    server.finish('c11');
    const result = await running;
    expect(server.started).toEqual(items(12));
    expect(server.waits).toEqual(Array.from({ length: 11 }, (_, index) => 510 + 10 * index));
    expect(result).toEqual({ end: 'done', loaded: 12, failed: 0, left: 0 });
  });

  it('plus de place dans la minute : plus aucun départ, celles parties vont à leur terme', async () => {
    const server = controlled();
    let count = 25;
    const running = loadBatch(items(5), {
      load: (item) => {
        count++;
        return server.load(item);
      },
      wait: server.wait,
      room: () => hasRoom(rate(count)),
      signal,
      onProgress: noop,
    });
    await flush();
    expect(server.started).toEqual(['c0', 'c1', 'c2']);
    for (const item of server.started) server.finish(item);
    expect(await running).toEqual({ end: 'limit', loaded: 3, failed: 0, left: 2 });
  });

  it('refus pour trop de requêtes : plus aucun départ', async () => {
    const refusal = new SiteApiError('Trop de requêtes automatisées.', 403, 'automation_limit');
    const result = await loadBatch(items(4), {
      load: (item) => (item === 'c1' ? Promise.reject(refusal) : Promise.resolve()),
      wait: () => flush(),
      room: () => true,
      signal,
      onProgress: noop,
    });
    expect(result).toEqual({ end: 'refused', loaded: 1, failed: 1, left: 2, error: refusal });
  });

  it('échecs isolés : on continue ; trois de suite : arrêt', async () => {
    const failure = new SiteApiError('Erreur 500 du site.', 500);
    const fails = new Set(['c1', 'c3', 'c4', 'c5']);
    const result = await loadBatch(items(7), {
      load: (item) => (fails.has(item) ? Promise.reject(failure) : Promise.resolve()),
      wait: () => flush(),
      room: () => true,
      signal,
      onProgress: noop,
    });
    expect(MAX_FAILURES).toBe(3);
    expect(result).toEqual({ end: 'failures', loaded: 2, failed: 4, left: 1, error: failure });
  });

  it('page quittée : plus aucun départ', async () => {
    const controller = new AbortController();
    const result = await loadBatch(items(3), {
      load: () => {
        controller.abort();
        return Promise.resolve();
      },
      wait: () => Promise.resolve(),
      room: () => true,
      signal: controller.signal,
      onProgress: noop,
    });
    expect(result).toEqual({ end: 'aborted', loaded: 1, failed: 0, left: 2 });
  });
});
