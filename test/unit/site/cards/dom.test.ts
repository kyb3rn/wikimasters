import { describe, expect, it } from 'vitest';
import { parseStarLabel } from '@/site/cards';

describe('parseStarLabel', () => {
  it('lit les libellés de mes exemplaires (site du 10/10/2026)', () => {
    expect(parseStarLabel('Ajouter aux favoris (verrouille la carte : ni défausse, ni vente, ni échange)', false)).toEqual({ starred: false, friend: false });
    expect(parseStarLabel('Retirer des favoris (déverrouille la carte)', true)).toEqual({ starred: true, friend: false });
  });

  it('lit les libellés de l’exemplaire d’un ami', () => {
    expect(parseStarLabel('Pas en favori chez Alice', false)).toEqual({ starred: false, friend: true });
    expect(parseStarLabel('En favori chez Alice : carte verrouillée', true)).toEqual({ starred: true, friend: true });
  });

  it('lit encore les anciens libellés', () => {
    expect(parseStarLabel('Ajouter aux favoris', false).starred).toBe(false);
    expect(parseStarLabel('Retirer des favoris', true).starred).toBe(true);
  });

  it('libellé inconnu ou étoile remplie : en favori', () => {
    expect(parseStarLabel('Favori', false).starred).toBe(true);
    expect(parseStarLabel('', false).starred).toBe(true);
    expect(parseStarLabel('Ajouter aux favoris', true).starred).toBe(true);
  });
});
