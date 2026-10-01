import { describe, expect, it } from 'vitest';
import { Icon } from '@/ui/icons';

/** Classe et tracés de l'icône dessinée (le composant est une simple fonction). */
const drawn = (props: Parameters<typeof Icon>[0]) => {
  const { props: svg } = Icon(props) as unknown as { props: { class?: string; children: unknown } };
  return { class: svg.class, children: svg.children };
};

describe('Icon', () => {
  it('dessine l’icône demandée, avec sa classe', () => {
    expect(drawn({ name: 'reload', class: 'x' }).class).toBe('x');
    expect(drawn({ name: 'reload' }).class).toBeUndefined();
  });

  it('la roue tourne d’office', () => {
    expect(drawn({ name: 'spinner' }).class).toBe('wm-spin');
    expect(drawn({ name: 'spinner', class: 'x' }).class).toBe('x wm-spin');
  });

  it('en cours : la roue, qui tourne, à la place de l’icône', () => {
    const busy = drawn({ name: 'reload', busy: true, class: 'x' });
    expect(busy.class).toBe('x wm-spin');
    expect(busy.children).toBe(drawn({ name: 'spinner' }).children);
    expect(drawn({ name: 'reload', busy: false }).children).toBe(drawn({ name: 'reload' }).children);
  });
});
