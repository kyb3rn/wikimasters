import { describe, expect, it } from 'vitest';
import { createRouter, type RouterHost } from '@/core/router';
import { memoryLogger } from '../../support';

/** Fenêtre minimale : un historique qui met à jour `location.pathname` comme le navigateur. */
function fakeHost(start: string) {
  const location = { pathname: start } as Location;
  const popstate: (() => void)[] = [];
  const setPath = (url?: string | URL | null) => {
    if (url) location.pathname = new URL(url, 'https://www.wiki-masters.com' + location.pathname).pathname;
  };
  const history = {
    pushState: (_data: unknown, _unused: string, url?: string | URL | null) => setPath(url),
    replaceState: (_data: unknown, _unused: string, url?: string | URL | null) => setPath(url),
  } as History;
  const host: RouterHost = {
    history,
    location,
    addEventListener: (_type, listener) => popstate.push(listener),
  };
  return {
    host,
    back: (path: string) => {
      location.pathname = path;
      popstate.forEach((l) => l());
    },
  };
}

describe('createRouter', () => {
  it('signale les navigations par pushState, replaceState et retour arrière', () => {
    const { host, back } = fakeHost('/');
    const router = createRouter(host, memoryLogger());
    const seen: string[] = [];
    router.onChange((path) => seen.push(path));

    host.history.pushState(null, '', '/pulls');
    host.history.replaceState(null, '', '/collection');
    back('/pulls');

    expect(seen).toEqual(['/pulls', '/collection', '/pulls']);
    expect(router.path).toBe('/pulls');
  });

  it('ne signale pas un changement de ?… ou de #… seul', () => {
    const { host } = fakeHost('/marketplace');
    const router = createRouter(host, memoryLogger());
    const seen: string[] = [];
    router.onChange((path) => seen.push(path));

    host.history.pushState(null, '', '/marketplace?sort=price');
    expect(seen).toEqual([]);
  });

  it('retire un écouteur quand son signal est interrompu', () => {
    const { host } = fakeHost('/');
    const router = createRouter(host, memoryLogger());
    const controller = new AbortController();
    const seen: string[] = [];
    router.onChange((path) => seen.push(path), { signal: controller.signal });

    host.history.pushState(null, '', '/a');
    controller.abort();
    host.history.pushState(null, '', '/b');
    expect(seen).toEqual(['/a']);
  });

  it('isole un écouteur en échec : les autres sont appelés, la navigation du site aussi', () => {
    const { host } = fakeHost('/');
    const log = memoryLogger();
    const router = createRouter(host, log);
    const seen: string[] = [];
    router.onChange(() => {
      throw new Error('boum');
    });
    router.onChange((path) => seen.push(path));

    expect(() => host.history.pushState(null, '', '/a')).not.toThrow();
    expect(seen).toEqual(['/a']);
    expect(log.errors).toHaveLength(1);
  });
});
