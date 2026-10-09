import { describe, expect, it } from 'vitest';
import { keepsTyped, readTyped } from '@/features/auction-typed-bid/typed';

describe('readTyped', () => {
  it('garde le texte tel quel avec sa valeur', () => {
    expect(readTyped('300')).toEqual({ text: '300', amount: 300 });
    expect(readTyped('0300')).toEqual({ text: '0300', amount: 300 });
  });

  it('champ vide : aucun montant', () => {
    expect(readTyped('')).toBeUndefined();
    expect(readTyped('  ')).toBeUndefined();
  });
});

describe('keepsTyped', () => {
  const typed = { text: '300', amount: 300 };

  it('mise minimum égale ou plus basse : le montant saisi reste', () => {
    expect(keepsTyped(typed, '220', '220')).toBe(true);
    expect(keepsTyped(typed, '300', '300')).toBe(true);
  });

  it('mise minimum au-dessus : la valeur du site reste', () => {
    expect(keepsTyped(typed, '330', '330')).toBe(false);
  });

  it('minimum d’un refus plus haut que l’attribut `min` (mises manquées) : le plus haut compte', () => {
    expect(keepsTyped(typed, '400', '165')).toBe(false);
  });

  it('valeur ou minimum illisible : seul l’autre compte', () => {
    expect(keepsTyped(typed, '', '220')).toBe(true);
    expect(keepsTyped(typed, '220', '')).toBe(true);
    expect(keepsTyped(typed, '', '330')).toBe(false);
  });
});
