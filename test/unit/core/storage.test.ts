import { afterEach, describe, expect, it, vi } from 'vitest';
import { jsonStore } from '@/core/storage';
import { fakeStorage } from '../support';

const parseCount = (raw: unknown) => (typeof raw === 'number' ? raw : undefined);

describe('jsonStore', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('écrit et relit du JSON', () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    const store = jsonStore('wm-test-v1', 0, parseCount);

    store.set(3);
    expect(storage.data.get('wm-test-v1')).toBe('3');
    expect(store.update((n) => n + 1)).toBe(4);
    expect(store.get()).toBe(4);
  });

  it('retombe sur la valeur de repli si la valeur relue est invalide', () => {
    vi.stubGlobal('localStorage', fakeStorage({ a: '"texte"', b: '{pas du json' }));
    expect(jsonStore('a', 7, parseCount).get()).toBe(7);
    expect(jsonStore('b', 7, parseCount).get()).toBe(7);
    expect(jsonStore('absente', 7, parseCount).get()).toBe(7);
  });

  it('reste utilisable en mémoire si le localStorage refuse', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('bloqué');
      },
      setItem: () => {
        throw new Error('plein');
      },
    });
    const store = jsonStore('wm-test-v1', 0, parseCount);
    store.set(5);
    expect(store.get()).toBe(5);
  });
});
