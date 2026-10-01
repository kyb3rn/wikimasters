import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type * as Dom from '@/core/dom';
import { installFakeDocument, installFakeObservers } from '../fake-dom';

let frames: (() => void)[];
let observers: ReturnType<typeof installFakeObservers>;
let dom: typeof Dom;

beforeEach(async () => {
  // Un seul observateur et une seule liste de rappels pour tout le module : un module neuf par test.
  vi.resetModules();
  dom = await import('@/core/dom');
  installFakeDocument();
  observers = installFakeObservers();
  frames = [];
  vi.stubGlobal('requestAnimationFrame', (callback: () => void) => frames.push(callback));
});
afterEach(() => {
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

function nextFrame(): void {
  for (const frame of frames.splice(0)) frame();
}

const signal = () => new AbortController().signal;

describe('watchDom', () => {
  it('une inscription rejoue tous les rappels à l’image suivante, une passe par image', () => {
    const calls: string[] = [];
    dom.watchDom(() => calls.push('a'), { signal: signal() });
    nextFrame();
    dom.watchDom(() => calls.push('b'), { signal: signal() });
    expect(calls).toEqual(['a']);
    nextFrame();
    expect(calls).toEqual(['a', 'a', 'b']);
    expect(observers.instances).toHaveLength(1);
    expect(dom.domSyncRounds()).toBe(2);
  });

  it('`observe` en échec (avant <html>) : le rappel n’est pas gardé', () => {
    observers.failing = true;
    let early = 0;
    expect(() => dom.watchDom(() => early++, { signal: signal() })).toThrow();
    observers.failing = false;
    dom.watchDom(() => {}, { signal: signal() });
    nextFrame();
    expect(early).toBe(0);
  });

  it('débranche l’observateur quand le dernier rappel est retiré', () => {
    const [a, b] = [new AbortController(), new AbortController()];
    dom.watchDom(() => {}, { signal: a.signal });
    dom.watchDom(() => {}, { signal: b.signal });
    a.abort();
    expect(observers.instances[0]?.connected).toBe(true);
    b.abort();
    expect(observers.instances[0]?.connected).toBe(false);
  });

  it('un rappel en échec n’empêche pas les suivants', () => {
    const errors = vi.spyOn(console, 'error').mockImplementation(() => {});
    let called = false;
    dom.watchDom(
      () => {
        throw new Error('boum');
      },
      { signal: signal() },
    );
    dom.watchDom(() => (called = true), { signal: signal() });
    nextFrame();
    expect(called).toBe(true);
    expect(errors).toHaveBeenCalledOnce();
  });
});
