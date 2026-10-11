import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { quickDiscardProtection } from '@/services/quick-discard';
import { fakeStorage } from '../../support';

beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

describe('défaussage rapide : protections communes', () => {
  it('protège les étiquettes par défaut', () => {
    expect(quickDiscardProtection({ tagged: true })).toBe('carte avec une étiquette');
    expect(quickDiscardProtection({ tagged: false })).toBeUndefined();
  });
});
