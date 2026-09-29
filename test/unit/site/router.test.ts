import { describe, expect, it, vi } from 'vitest';
import { findNextRouter, wrapPush, type NextRouter } from '@/site/router';

function fakeRouter(): NextRouter & { pushed: string[] } {
  const pushed: string[] = [];
  return { pushed, push: (href: string) => void pushed.push(href), replace: () => {}, prefetch: () => {} };
}

/** Document minimal : `<main>` porte un fiber React dont un ancêtre fournit le routeur (contexte). */
function fakeDocument(router: NextRouter | undefined): Document {
  const main = {
    __reactFiber$abc: {
      memoizedProps: { className: 'x' },
      return: { memoizedProps: { children: [] }, return: { memoizedProps: { value: router }, return: null } },
    },
  };
  return { querySelector: () => main, body: null, documentElement: null } as unknown as Document;
}

describe('routeur Next.js', () => {
  it('trouve le routeur dans les ancêtres React de <main>', () => {
    const router = fakeRouter();
    expect(findNextRouter(fakeDocument(router))).toBe(router);
    expect(findNextRouter(fakeDocument(undefined))).toBeUndefined();
  });

  it('bloque les navigations refusées par la garde, laisse passer les autres, une seule enveloppe', () => {
    const router = fakeRouter();
    const guard = vi.fn((href: string) => href.startsWith('/marketplace/'));
    wrapPush(router, guard);
    wrapPush(router, () => true);

    router.push('/marketplace/a1');
    router.push('/collection');
    expect(router.pushed).toEqual(['/collection']);
    expect(guard).toHaveBeenCalledTimes(2);
  });
});
