import { describe, expect, it } from 'vitest';
import { alpha, layers } from '@/ui/theme';

describe('thème', () => {
  it('alpha : la couleur à ce pourcentage, en oklab sauf demande', () => {
    expect(alpha('red', 45)).toBe('color-mix(in oklab, red 45%, transparent)');
    expect(alpha('var(--x)', 15, 'srgb')).toBe('color-mix(in srgb, var(--x) 15%, transparent)');
  });

  it('calques : fenêtres, modales, menus puis toasts, de bas en haut', () => {
    const order = [layers.pageOverlay, layers.window, layers.modal, layers.menu, layers.toast];
    expect([...order].sort((a, b) => a - b)).toEqual(order);
    expect(new Set(order).size).toBe(order.length);
  });
});
