import { describe, expect, it } from 'vitest';
import { createListeners } from '@/core/listeners';
import { memoryLogger } from '../support';

describe('createListeners', () => {
  it('prévient les abonnés dans l’ordre, avec les arguments', () => {
    const listeners = createListeners<[string, number]>();
    const seen: string[] = [];
    listeners.on((a, b) => seen.push(`1 ${a} ${b}`));
    listeners.on((a, b) => seen.push(`2 ${a} ${b}`));
    listeners.emit('x', 3);
    expect(seen).toEqual(['1 x 3', '2 x 3']);
    expect(listeners.size).toBe(2);
  });

  it('retire un abonné à l’interruption de son signal, et ignore un signal déjà interrompu', () => {
    const listeners = createListeners();
    const controller = new AbortController();
    let calls = 0;
    listeners.on(() => calls++, { signal: controller.signal });
    listeners.on(() => calls++, { signal: AbortSignal.abort() });
    expect(listeners.size).toBe(1);
    listeners.emit();
    controller.abort();
    listeners.emit();
    expect(calls).toBe(1);
    expect(listeners.size).toBe(0);
  });

  it('une même fonction inscrite deux fois est appelée deux fois, retirée par chacun de ses signaux', () => {
    const listeners = createListeners();
    const first = new AbortController();
    let calls = 0;
    const listener = () => calls++;
    listeners.on(listener, { signal: first.signal });
    listeners.on(listener);
    listeners.emit();
    first.abort();
    listeners.emit();
    expect(calls).toBe(3);
  });

  it('journalise une erreur et prévient les abonnés suivants', () => {
    const log = memoryLogger();
    const listeners = createListeners(log, 'écouteur de test');
    let called = false;
    listeners.on(() => {
      throw new Error('boum');
    });
    listeners.on(() => (called = true));
    expect(() => listeners.emit()).not.toThrow();
    expect(called).toBe(true);
    expect(log.errors).toEqual([['écouteur de test en échec', new Error('boum')]]);
  });

  it('pendant une diffusion : un abonné retiré n’est plus appelé, un nouveau attend la suivante', () => {
    const listeners = createListeners();
    const later = new AbortController();
    const seen: string[] = [];
    listeners.on(() => {
      seen.push('a');
      later.abort();
      listeners.on(() => seen.push('nouveau'));
    });
    listeners.on(() => seen.push('b'), { signal: later.signal });
    listeners.emit();
    expect(seen).toEqual(['a']);
    listeners.emit();
    expect(seen).toEqual(['a', 'a', 'nouveau']);
  });
});
