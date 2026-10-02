import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

type Factory = (context: object, module: { exports: unknown }, exports: unknown) => void;

/**
 * Registre de Turbopack imité d'après son exécution (02/10/2026) : `[chemin, id, fabrique, …]` inscrit (sans
 * remplacer), `[chemin, { runtimeModuleIds }]` lance après une tâche ; contexte des modules : `i`, `A`, `M` et `c`
 * sur son prototype.
 */
function fakeTurbopack() {
  const factories = new Map<unknown, Factory>();
  const cache: Record<string, { exports: unknown }> = {};
  const proto = {
    M: factories,
    c: cache,
    i: (id: unknown) => instantiate(id).exports,
    A(this: { i: (id: unknown) => unknown }, id: unknown): Promise<unknown> {
      return (instantiate(id).exports as (load: (id: unknown) => unknown) => Promise<unknown>)(this.i);
    },
  };
  function instantiate(id: unknown): { exports: unknown } {
    const key = String(id);
    const existing = cache[key];
    if (existing) return existing;
    const factory = factories.get(id);
    if (!factory) throw new Error(`Module ${key} absent`);
    const module = { exports: {} as unknown };
    cache[key] = module;
    factory(Object.create(proto) as object, module, module.exports);
    return module;
  }
  const registry = {
    push(chunk: unknown[]) {
      if (chunk.length === 2) {
        const { runtimeModuleIds } = chunk[1] as { runtimeModuleIds: unknown[] };
        void Promise.resolve().then(() => runtimeModuleIds.forEach((id) => instantiate(id)));
        return;
      }
      for (let i = 1; i < chunk.length; i += 2) {
        if (!factories.has(chunk[i])) factories.set(chunk[i], chunk[i + 1] as Factory);
      }
    },
  };
  return { registry, factories, instantiate };
}

async function freshModule() {
  vi.resetModules();
  return import('@/core/turbopack');
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});

describe('pageModules', () => {
  beforeEach(() => vi.unstubAllGlobals());

  it('sans Turbopack, ou pas encore chargé (tableau en attente) : rien', async () => {
    const { pageModules } = await freshModule();
    expect(await pageModules()).toBeUndefined();
    vi.stubGlobal('TURBOPACK', []);
    expect(await pageModules()).toBeUndefined();
  });

  it('lit les modules du site par un module à nous, lancé une fois', async () => {
    const site = fakeTurbopack();
    const react: Factory = (_context, module) => (module.exports = { createElement: () => null });
    const page: Factory = (_context, module) => (module.exports = { default: 'page' });
    const loader: Factory = (_context, module) => (module.exports = (load: (id: unknown) => unknown) => Promise.resolve(load(3)));
    site.registry.push(['chunk.js', 1, react, 2, loader, 3, page]);
    site.instantiate(1);
    vi.stubGlobal('TURBOPACK', site.registry);

    const { pageModules } = await freshModule();
    const first = pageModules();
    expect(pageModules()).toBe(first);
    const modules = await first;
    if (!modules) throw new Error('modules illisibles');

    expect([...modules.sources()].filter(([id]) => typeof id === 'number')).toEqual([
      [1, react.toString()],
      [2, loader.toString()],
      [3, page.toString()],
    ]);
    expect([...modules.loaded()]).toContainEqual({ createElement: expect.any(Function) as unknown });
    expect(await modules.load(2)).toEqual({ default: 'page' });
    expect(modules.require(3)).toEqual({ default: 'page' });
    expect([...site.factories.keys()].filter((id) => typeof id === 'string')).toEqual(['wikimasters-1']);
  });

  it('registre muet : abandon après 2 s, puis nouvel essai sous un autre identifiant', async () => {
    vi.useFakeTimers();
    const pushed: unknown[][] = [];
    vi.stubGlobal('TURBOPACK', { push: (chunk: unknown[]) => pushed.push(chunk) });
    const { pageModules } = await freshModule();

    const first = pageModules();
    await vi.advanceTimersByTimeAsync(2000);
    expect(await first).toBeUndefined();
    void pageModules();
    expect(pushed.map((chunk) => chunk[1])).toEqual([
      'wikimasters-1',
      { otherChunks: [], runtimeModuleIds: ['wikimasters-1'] },
      'wikimasters-2',
      { otherChunks: [], runtimeModuleIds: ['wikimasters-2'] },
    ]);
  });
});
