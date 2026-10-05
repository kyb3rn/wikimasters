import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { importSettings, mergeSettings, parseStoredSettings, readSettings, SETTINGS_KEY, type StoredSettings } from '@/core/settings';
import { fakeStorage } from '../../support';

const settings = (partial: Partial<StoredSettings>): StoredSettings => ({
  features: {},
  values: {},
  changedAt: { features: {}, values: {} },
  ...partial,
});

describe('fusion des réglages', () => {
  it('ajoute ce qui manque ici', () => {
    const { result, outcomes } = mergeSettings(
      settings({}),
      settings({ features: { resale: true }, values: { market: { cacheHours: 72 } }, changedAt: { features: { resale: 5 }, values: { market: { cacheHours: 5 } } } }),
    );
    expect(result.features).toEqual({ resale: true });
    expect(result.values).toEqual({ market: { cacheHours: 72 } });
    expect(result.changedAt).toEqual({ features: { resale: 5 }, values: { market: { cacheHours: 5 } } });
    expect(outcomes).toEqual(['added', 'added']);
  });

  it('le plus récemment changé l’emporte, réglage par réglage ; à égalité, celui d’ici', () => {
    const local = settings({
      features: { resale: true, debug: false },
      values: { market: { cacheHours: 48, average: 7 } },
      changedAt: { features: { resale: 100, debug: 100 }, values: { market: { cacheHours: 300, average: 100 } } },
    });
    const incoming = settings({
      features: { resale: false, debug: true },
      values: { market: { cacheHours: 72, average: 12 } },
      changedAt: { features: { resale: 200, debug: 100 }, values: { market: { cacheHours: 200, average: 200 } } },
    });
    const { result, outcomes } = mergeSettings(local, incoming);
    expect(result.features).toEqual({ resale: false, debug: false });
    expect(result.values).toEqual({ market: { cacheHours: 48, average: 12 } });
    expect(result.changedAt.values).toEqual({ market: { cacheHours: 300, average: 200 } });
    expect(outcomes).toEqual(['updated', 'unchanged', 'unchanged', 'updated']);
  });

  it('un réglage d’avant les dates ne remplace pas celui d’ici', () => {
    const { result } = mergeSettings(settings({ features: { resale: true } }), settings({ features: { resale: false } }));
    expect(result.features).toEqual({ resale: true });
  });

  it('écarte les valeurs qui ne sont ni booléen ni nombre', () => {
    const incoming = parseStoredSettings({ values: { market: { cacheHours: 'beaucoup', sound: true } } });
    expect(incoming && mergeSettings(settings({}), incoming).result.values).toEqual({ market: { sound: true } });
  });
});

describe('import des réglages', () => {
  beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
  afterEach(() => vi.unstubAllGlobals());

  it('compte sans écrire, puis écrit', () => {
    const file = { features: { resale: true }, changedAt: { features: { resale: 9 } } };
    expect(importSettings(file, false)).toEqual({ added: 1, updated: 0, unchanged: 0, invalid: 0 });
    expect(localStorage.getItem(SETTINGS_KEY)).toBeNull();
    importSettings(file, true);
    expect(readSettings().features).toEqual({ resale: true });
    expect(importSettings(file, true)).toEqual({ added: 0, updated: 0, unchanged: 1, invalid: 0 });
  });

  it('refuse un contenu illisible', () => {
    expect(importSettings('rien', true)).toBeUndefined();
  });
});
