import { describe, expect, it } from 'vitest';
import { isRecord, isSet, parseJson } from '@/core/guards';

describe('gardes', () => {
  it('isRecord : objet simple seulement', () => {
    expect(isRecord({ a: 1 })).toBe(true);
    expect(isRecord([])).toBe(false);
    expect(isRecord(null)).toBe(false);
  });

  it('isSet', () => {
    expect(isSet(new Set([1]))).toBe(true);
    expect(isSet([1])).toBe(false);
    expect(isSet(new Map())).toBe(false);
  });

  it('parseJson : valeur du texte, `undefined` s’il est invalide', () => {
    expect(parseJson('{"a":[1]}')).toEqual({ a: [1] });
    expect(parseJson('null')).toBeNull();
    expect(parseJson('{pas du json')).toBeUndefined();
    expect(parseJson('')).toBeUndefined();
  });
});
