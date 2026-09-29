import { afterEach, describe, expect, it, vi } from 'vitest';
import { childController, sleep, waitUntil } from '@/core/async';

describe('waitUntil', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Une image toutes les 16 ms (Node n'a pas requestAnimationFrame). */
  function frames() {
    vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout', 'performance'] });
    vi.stubGlobal('requestAnimationFrame', (callback: () => void) => setTimeout(callback, 16));
    vi.stubGlobal('cancelAnimationFrame', (id: ReturnType<typeof setTimeout>) => clearTimeout(id));
  }

  it('vérifie tout de suite, puis à chaque image', async () => {
    frames();
    let ready = false;
    const wait = waitUntil(() => ready, { signal: new AbortController().signal });
    await vi.advanceTimersByTimeAsync(100);
    ready = true;
    await vi.advanceTimersByTimeAsync(16);
    await expect(wait).resolves.toBe(true);
    await expect(waitUntil(() => true, { signal: new AbortController().signal })).resolves.toBe(true);
  });

  it('faux à l’échéance ou à l’interruption', async () => {
    frames();
    const late = waitUntil(() => false, { signal: new AbortController().signal, timeoutMs: 50 });
    await vi.advanceTimersByTimeAsync(100);
    await expect(late).resolves.toBe(false);

    const controller = new AbortController();
    const aborted = waitUntil(() => false, { signal: controller.signal });
    controller.abort();
    await vi.advanceTimersByTimeAsync(0);
    await expect(aborted).resolves.toBe(false);
  });
});

describe('sleep', () => {
  it('attend la durée demandée', async () => {
    vi.useFakeTimers();
    let done = false;
    const wait = sleep(500).then(() => (done = true));
    await vi.advanceTimersByTimeAsync(499);
    expect(done).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await wait;
    expect(done).toBe(true);
    vi.useRealTimers();
  });

  it('se termine tout de suite quand le signal est interrompu', async () => {
    const controller = new AbortController();
    const wait = sleep(60_000, controller.signal);
    controller.abort();
    await expect(wait).resolves.toBeUndefined();
  });
});

describe('childController', () => {
  it('suit l’interruption du parent, et peut être interrompu seul', () => {
    const parent = new AbortController();
    const a = childController(parent.signal);
    const b = childController(parent.signal);
    b.abort();
    expect(parent.signal.aborted).toBe(false);
    parent.abort();
    expect(a.signal.aborted).toBe(true);
    expect(childController(parent.signal).signal.aborted).toBe(true);
  });
});
