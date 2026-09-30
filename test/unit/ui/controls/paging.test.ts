import { describe, expect, it } from 'vitest';
import { pageTargets, parsePage } from '@/ui/controls';

describe('pageTargets', () => {
  it('au milieu : toutes les pages', () => {
    expect(pageTargets(3, 5)).toEqual({ first: 1, previous: 2, next: 4, last: 5 });
  });

  it('première et dernière page', () => {
    expect(pageTargets(1, 5)).toEqual({ first: undefined, previous: undefined, next: 2, last: 5 });
    expect(pageTargets(5, 5)).toEqual({ first: 1, previous: 4, next: undefined, last: undefined });
  });

  it('nombre de pages inconnu : pas de dernière page, suivante selon hasNext', () => {
    expect(pageTargets(2, undefined)).toEqual({ first: 1, previous: 1, next: 3, last: undefined });
    expect(pageTargets(2, undefined, false)).toEqual({ first: 1, previous: 1, next: undefined, last: undefined });
  });
});

describe('parsePage', () => {
  it('entier borné aux pages qui existent', () => {
    expect(parsePage('4', 29)).toBe(4);
    expect(parsePage(' 4,7 ', 29)).toBe(4);
    expect(parsePage('0', 29)).toBe(1);
    expect(parsePage('-3', 29)).toBe(1);
    expect(parsePage('99', 29)).toBe(29);
    expect(parsePage('99', undefined)).toBe(99);
  });

  it('pas un nombre : rien', () => {
    expect(parsePage('', 29)).toBeUndefined();
    expect(parsePage('  ', 29)).toBeUndefined();
    expect(parsePage('abc', 29)).toBeUndefined();
  });
});
