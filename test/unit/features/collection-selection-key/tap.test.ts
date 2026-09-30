import { describe, expect, it } from 'vitest';
import { createCtrlTap, TAP_MAX_MS } from '@/features/collection-selection-key/tap';

const key = (name: string, extra: Partial<{ repeat: boolean; shiftKey: boolean; altKey: boolean; metaKey: boolean }> = {}) => ({
  key: name,
  repeat: false,
  shiftKey: false,
  altKey: false,
  metaKey: false,
  ...extra,
});

describe('appui sur Ctrl seul', () => {
  it('enfoncé puis relâché : oui', () => {
    const tap = createCtrlTap();
    tap.keydown(key('Control'), 0);
    tap.keydown(key('Control', { repeat: true }), 300);
    expect(tap.keyup(key('Control'), 400)).toBe(true);
    // Une seule fois.
    expect(tap.keyup(key('Control'), 450)).toBe(false);
  });

  it('avec une autre touche (Ctrl+C, AltGr), un modificateur, un clic ou trop long : non', () => {
    const tap = createCtrlTap();
    tap.keydown(key('Control'), 0);
    tap.keydown(key('c'), 50);
    expect(tap.keyup(key('Control'), 100)).toBe(false);

    tap.keydown(key('Control', { shiftKey: true }), 0);
    expect(tap.keyup(key('Control'), 100)).toBe(false);

    tap.keydown(key('Control'), 0);
    tap.cancel();
    expect(tap.keyup(key('Control'), 100)).toBe(false);

    tap.keydown(key('Control'), 0);
    expect(tap.keyup(key('Control'), TAP_MAX_MS + 1)).toBe(false);
  });

  it('une autre touche relâchée n’est pas un appui', () => {
    const tap = createCtrlTap();
    tap.keydown(key('Control'), 0);
    expect(tap.keyup(key('Shift'), 50)).toBe(false);
    expect(tap.keyup(key('Control'), 100)).toBe(true);
  });
});
