import { describe, expect, it } from 'vitest';
import { CARD_WIDTH, GAP_X, gridLayout } from '@/features/pulls-grid/layout';

describe('disposition de la grille', () => {
  it('paquet de 5 cartes sur grand écran : une ligne, taille du carrousel', () => {
    expect(gridLayout(5, 2200, 1100)).toEqual({ columns: 5, zoom: 1, width: 5 * CARD_WIDTH + 4 * GAP_X + 1 });
  });

  it('paquet PRO de 15 cartes : lignes de 5, réduites pour tenir en hauteur', () => {
    const layout = gridLayout(15, 2200, 1100);
    expect(layout.columns).toBe(5);
    // 3 lignes : (1100 - 3 × 60 - 2 × 24) / (3 × 420)
    expect(layout.zoom).toBe(0.692);
  });

  it('jamais plus de 5 par ligne, ni plus que de cartes', () => {
    expect(gridLayout(7, 5000, 5000).columns).toBe(5);
    expect(gridLayout(3, 5000, 5000).columns).toBe(3);
  });

  it('trop étroit : cartes réduites, puis moins de cartes par ligne', () => {
    const narrow = gridLayout(5, 1200, 2000);
    expect(narrow.columns).toBe(5);
    expect(narrow.zoom).toBeCloseTo((1200 - 4 * GAP_X) / (5 * CARD_WIDTH), 2);
    expect(gridLayout(5, 700, 2000).columns).toBeLessThan(5);
    expect(gridLayout(5, 300, 5000)).toMatchObject({ columns: 1, zoom: 1 });
  });

  it('pas plus petit que 0,6 pour tenir en hauteur : la page défile', () => {
    expect(gridLayout(15, 2200, 400).zoom).toBe(0.6);
  });

  it('la largeur laisse passer exactement `columns` cartes par ligne', () => {
    const { columns, zoom, width } = gridLayout(15, 1300, 700);
    expect(width).toBeGreaterThanOrEqual(columns * CARD_WIDTH * zoom + (columns - 1) * GAP_X);
    expect(width).toBeLessThan((columns + 1) * CARD_WIDTH * zoom + columns * GAP_X);
  });
});
