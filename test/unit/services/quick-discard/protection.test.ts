import { describe, expect, it } from 'vitest';
import { protectionReason } from '@/services/quick-discard';

const facts = { tagged: false };
const rules = { tagged: true };

describe('protection du défaussage rapide', () => {
  it('protège une carte étiquetée, selon les réglages', () => {
    expect(protectionReason({ tagged: true }, rules)).toBe('carte avec une étiquette');
    expect(protectionReason({ tagged: true }, { tagged: false })).toBeUndefined();
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
