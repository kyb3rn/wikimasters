import { describe, expect, it } from 'vitest';
import { parseWishedPriceText } from '@/features/resale/WishedPriceModal';

describe('saisie du prix souhaité', () => {
  it('entier positif, blancs tolérés', () => {
    expect(parseWishedPriceText('1500')).toBe(1500);
    expect(parseWishedPriceText(' 1 500 ')).toBe(1500);
  });

  it('refuse vide, zéro, décimal, négatif, texte, trop grand', () => {
    for (const text of ['', '0', '12,5', '-3', 'abc', '99999999999']) expect(parseWishedPriceText(text)).toBeUndefined();
  });
});
