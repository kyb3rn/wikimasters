import { describe, expect, it } from 'vitest';
import { normalizeText, textOf } from '@/core/text';

describe('normalizeText', () => {
  it('réduit les blancs à un espace et coupe les bords', () => {
    expect(normalizeText('  Mettre\n  aux enchères \t')).toBe('Mettre aux enchères');
    expect(normalizeText(null)).toBe('');
    expect(normalizeText(undefined)).toBe('');
  });
});

describe('textOf', () => {
  it('lit le texte d’un nœud, normalisé', () => {
    expect(textOf({ textContent: ' Page\n 2 / 10 ' } as Node)).toBe('Page 2 / 10');
    expect(textOf(null)).toBe('');
  });
});
