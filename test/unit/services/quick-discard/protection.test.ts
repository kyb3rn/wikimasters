import { describe, expect, it } from 'vitest';
import { protectionReason } from '@/services/quick-discard';

const facts = { starred: false, tagged: false };
const rules = { starred: true, tagged: true };

describe('protection du défaussage rapide', () => {
  it('protège une carte en favori ou étiquetée, selon les réglages', () => {
    expect(protectionReason({ ...facts, starred: true }, rules)).toBe('carte en favori');
    expect(protectionReason({ ...facts, tagged: true }, rules)).toBe('carte avec une étiquette');
    expect(protectionReason({ starred: true, tagged: true }, { starred: false, tagged: false })).toBeUndefined();
    expect(protectionReason(facts, rules)).toBeUndefined();
  });

  it('protège au-dessus d’une valeur quand elle est connue (prêt pour les prix du marché)', () => {
    const withValue = { ...rules, minValue: 30 };
    expect(protectionReason({ ...facts, value: 42.4 }, withValue)).toBe('vaut environ 42 wikibidous');
    expect(protectionReason({ ...facts, value: 30 }, withValue)).toBeUndefined();
    expect(protectionReason(facts, withValue)).toBeUndefined();
    expect(protectionReason({ ...facts, value: 500 }, rules)).toBeUndefined();
  });
});
