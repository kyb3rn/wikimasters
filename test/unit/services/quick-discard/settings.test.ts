import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quickDiscardProtection } from '@/services/quick-discard';
import { fakeStorage } from '../../support';

beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('défaussage rapide : protections communes', () => {
  it('protège favoris et étiquettes par défaut', () => {
    expect(quickDiscardProtection({ starred: true, tagged: false })).toBe('carte en favori');
    expect(quickDiscardProtection({ starred: false, tagged: true })).toBe('carte avec une étiquette');
    expect(quickDiscardProtection({ starred: false, tagged: false })).toBeUndefined();
  });
});
