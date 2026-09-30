import { describe, expect, it } from 'vitest';
import { splitProfileLine } from '@/site/profile';

describe('splitProfileLine', () => {
  it('sépare le nombre de cartes des autres textes, sans leur « · »', () => {
    expect(splitProfileLine(['1 416 cartes', '· Depuis sept. 2026'])).toEqual({
      cards: { value: '1 416', label: 'Cartes' },
      details: ['Depuis sept. 2026'],
    });
  });

  it('garde « Vu il y a… » (profil d’un autre joueur) et le singulier', () => {
    expect(splitProfileLine(['1 carte', '· Depuis août 2026', '· Vu il y a 33 min'])).toEqual({
      cards: { value: '1', label: 'Carte' },
      details: ['Depuis août 2026', 'Vu il y a 33 min'],
    });
  });

  it('sans nombre de cartes (compteurs pas encore reçus) : seulement les autres textes', () => {
    expect(splitProfileLine(['· Depuis sept. 2026', ''])).toEqual({ cards: undefined, details: ['Depuis sept. 2026'] });
  });
});
