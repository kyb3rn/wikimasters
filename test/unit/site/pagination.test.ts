import { describe, expect, it } from 'vitest';
import { parsePageLabel } from '@/site/pagination';

describe('parsePageLabel', () => {
  it('« Page x / y »', () => {
    expect(parsePageLabel('Page 3 / 29')).toEqual({ page: 3, total: 29 });
    expect(parsePageLabel(' Page 1 /  2 ')).toEqual({ page: 1, total: 2 });
  });

  it('sans total (recherche de Toutes les cartes) : suite disponible ou non', () => {
    expect(parsePageLabel('Page 2 · suite disponible')).toEqual({ page: 2, hasNext: true });
    expect(parsePageLabel('Page 4')).toEqual({ page: 4, hasNext: false });
  });

  it('rien pendant un chargement', () => {
    expect(parsePageLabel('Chargement…')).toBeUndefined();
    expect(parsePageLabel('')).toBeUndefined();
  });
});
