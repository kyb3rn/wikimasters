import { describe, expect, it } from 'vitest';
import { normalizeTagName, randomTagColor, tagChipStyle } from '@/site/collection';

describe('étiquettes du site', () => {
  it('pastille teintée de la couleur (comme tagChipSurfaceStyles)', () => {
    expect(tagChipStyle('#60a5fa')).toBe(
      'background-color: rgba(96, 165, 250, 0.22); border-color: rgba(96, 165, 250, 0.5); color: rgba(248, 250, 252, 0.95);',
    );
  });

  it('couleur illisible : le gris par défaut du site', () => {
    expect(tagChipStyle(undefined)).toContain('rgba(148, 163, 184, 0.22)');
    expect(tagChipStyle('bleu')).toContain('rgba(148, 163, 184, 0.22)');
  });

  it('couleur au hasard dans la palette', () => {
    expect(randomTagColor()).toMatch(/^#[0-9a-f]{6}$/);
  });

  it('noms comparés sans accents, casse ni espaces en trop', () => {
    expect(normalizeTagName('  Été   Indien ')).toBe('ete indien');
  });
});
