import { describe, expect, it } from 'vitest';
import { createRouter, type RouterHost } from '@/core/router';
import { memoryLogger } from '../../support';

/** Fenêtre minimale : un historique qui met à jour `location.pathname` et `location.search` comme le navigateur. */
function fakeHost(start: string) {
  const location = { pathname: start, search: '' } as Location;
  const popstate: (() => void)[] = [];
  const setPath = (url?: string | URL | null) => {
    if (!url) return;
    const next = new URL(url, 'https://www.wiki-masters.com' + location.pathname + location.search);
    location.pathname = next.pathname;
    location.search = next.search;
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
      setPath(path);
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

  it("signale un changement de vue (paramètre suivi), seul ou parmi d'autres paramètres", () => {
    const { host, back } = fakeHost('/collection');
    const router = createRouter(host, memoryLogger(), { viewKeys: ['vue'] });
    const seen: string[] = [];
    router.onChange((path) => seen.push(path));

    host.history.pushState(null, '', '/collection?vue=revente');
    host.history.replaceState(null, '', '/collection?sort=name&vue=revente#haut');
    host.history.pushState(null, '', '/collection?sort=name');
    back('/collection?vue=revente');

    expect(seen).toEqual(['/collection?vue=revente', '/collection', '/collection?vue=revente']);
    expect(router.path).toBe('/collection?vue=revente');
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
