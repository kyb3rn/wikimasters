import { afterEach, describe, expect, it, vi } from 'vitest';
import { isPlainClick, prefersReducedMotion } from '@/core/dom';

afterEach(() => vi.unstubAllGlobals());

const click = (init: Partial<MouseEvent>) =>
  ({ button: 0, ctrlKey: false, shiftKey: false, altKey: false, metaKey: false, ...init }) as MouseEvent;

describe('isPlainClick', () => {
  it('clic gauche seul', () => {
    expect(isPlainClick(click({}))).toBe(true);
  });

  it('pas avec une touche, ni le bouton du milieu', () => {
    for (const init of [{ ctrlKey: true }, { shiftKey: true }, { altKey: true }, { metaKey: true }, { button: 1 }]) {
      expect(isPlainClick(click(init))).toBe(false);
    }
  });
});

describe('prefersReducedMotion', () => {
  it('suit la préférence du système', () => {
    const queries: string[] = [];
    vi.stubGlobal('matchMedia', (query: string) => {
      queries.push(query);
      return { matches: true };
    });
    expect(prefersReducedMotion()).toBe(true);
    expect(queries).toEqual(['(prefers-reduced-motion: reduce)']);
  });
});
