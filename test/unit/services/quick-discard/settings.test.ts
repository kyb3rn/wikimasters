import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { readSettings, SETTINGS_KEY } from '@/core/settings';
import { migrateLegacyProtections, quickDiscardProtection } from '@/services/quick-discard';

let data: Map<string, string>;
beforeEach(() => {
  data = new Map();
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  });
});
afterEach(() => vi.unstubAllGlobals());

const store = (value: unknown) => data.set(SETTINGS_KEY, JSON.stringify(value));

describe('défaussage rapide : protections communes', () => {
  it('protège favoris et étiquettes par défaut', () => {
    expect(quickDiscardProtection({ starred: true, tagged: false })).toBe('carte en favori');
    expect(quickDiscardProtection({ starred: false, tagged: true })).toBe('carte avec une étiquette');
    expect(quickDiscardProtection({ starred: false, tagged: false })).toBeUndefined();
  });

  it('reprend une fois les protections réglées sur le défaussage des paquets', () => {
    store({ features: {}, values: { 'pulls-discard-next': { delayMs: 300, protectStarred: false } } });
    migrateLegacyProtections();
    expect(readSettings().values['quick-discard']).toEqual({ protectStarred: false });
    expect(quickDiscardProtection({ starred: true, tagged: false })).toBeUndefined();
  });

  it('ne touche pas à des protections déjà réglées', () => {
    store({ features: {}, values: { 'pulls-discard-next': { protectStarred: false }, 'quick-discard': { protectTagged: false } } });
    migrateLegacyProtections();
    expect(readSettings().values['quick-discard']).toEqual({ protectTagged: false });
  });
});
