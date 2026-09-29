import { describe, expect, it } from 'vitest';
import { createRuntime, type Feature, type FeatureContext } from '@/core/runtime';
import { flush, memoryLogger } from '../../support';

/** Fonctionnalité de test qui note ses montages et démontages. */
function probe(
  id: string,
  routes: Feature['routes'],
  mount?: (ctx: FeatureContext) => void | Promise<void>,
  extra: Partial<Feature> = {},
) {
  const events: string[] = [];
  const feature: Feature = {
    id,
    name: id,
    description: '',
    category: 'Test',
    routes,
    ...extra,
    mount(ctx) {
      events.push(`monte ${ctx.path} ${JSON.stringify(ctx.params)}`);
      ctx.onDispose(() => events.push('démonte'));
      return mount?.(ctx);
    },
  };
  return { feature, events };
}

function setup(features: Feature[], disabled: string[] = []) {
  const choices = new Map<string, boolean>(disabled.map((id) => [id, false]));
  const logs = memoryLogger();
  const runtime = createRuntime({
    features,
    isEnabled: (f) => choices.get(f.id) ?? f.enabledByDefault ?? true,
    saveEnabled: (id, enabled) => choices.set(id, enabled),
    createLogger: () => logs,
  });
  return { runtime, logs };
}

describe('createRuntime', () => {
  it('garde toujours active une fonctionnalité obligatoire, sans pouvoir la désactiver', () => {
    const settings = probe('settings', 'all', undefined, { required: true });
    const { runtime } = setup([settings.feature], ['settings']);

    runtime.update('/pulls');
    runtime.setEnabled('settings', false);

    expect(settings.events).toEqual(['monte /pulls {}']);
    expect(runtime.catalog.list()[0]).toMatchObject({ enabled: true, state: 'mounted' });
  });

  it('donne au catalogue chaque fonctionnalité avec son état, et signale les changements', () => {
    const a = probe('a', 'all');
    const b = probe('b', ['/pulls']);
    const { runtime } = setup([a.feature, b.feature]);
    let changes = 0;
    runtime.catalog.onChange(() => changes++);

    runtime.update('/collection');
    expect(runtime.catalog.list().map((e) => [e.feature.id, e.enabled, e.state])).toEqual([
      ['a', true, 'mounted'],
      ['b', true, 'idle'],
    ]);
    runtime.catalog.setEnabled('a', false);
    expect(runtime.catalog.list()[0]).toMatchObject({ enabled: false, state: 'off' });
    expect(changes).toBeGreaterThanOrEqual(2);
  });

  it('réapplique les choix d’activation changés ailleurs (refresh)', () => {
    const a = probe('a', 'all');
    const choices = new Map<string, boolean>();
    const runtime = createRuntime({
      features: [a.feature],
      isEnabled: (f) => choices.get(f.id) ?? true,
      saveEnabled: () => {},
      createLogger: () => memoryLogger(),
    });
    runtime.update('/pulls');
    choices.set('a', false);
    runtime.refresh();
    expect(a.events).toEqual(['monte /pulls {}', 'démonte']);
  });

  it('monte une fonctionnalité sur ses pages et la démonte ailleurs', () => {
    const fiche = probe('fiche', ['/marketplace/:id']);
    const { runtime } = setup([fiche.feature]);

    runtime.update('/pulls');
    runtime.update('/marketplace/a1');
    runtime.update('/collection');

    expect(fiche.events).toEqual(['monte /marketplace/a1 {"id":"a1"}', 'démonte']);
  });

  it('remonte quand les paramètres changent, pas quand ils restent les mêmes', () => {
    const fiche = probe('fiche', ['/marketplace/:id']);
    const { runtime } = setup([fiche.feature]);

    runtime.update('/marketplace/a1');
    runtime.update('/marketplace/a1/');
    runtime.update('/marketplace/b2');

    expect(fiche.events).toEqual(['monte /marketplace/a1 {"id":"a1"}', 'démonte', 'monte /marketplace/b2 {"id":"b2"}']);
  });

  it("garde montée une fonctionnalité de toutes les pages", () => {
    const partout = probe('partout', 'all');
    const { runtime } = setup([partout.feature]);

    runtime.update('/pulls');
    runtime.update('/collection');

    expect(partout.events).toEqual(['monte /pulls {}']);
  });

  it("interrompt le signal au démontage", () => {
    let signal: AbortSignal | undefined;
    const fiche = probe('fiche', ['/pulls'], (ctx) => {
      signal = ctx.signal;
    });
    const { runtime } = setup([fiche.feature]);

    runtime.update('/pulls');
    expect(signal?.aborted).toBe(false);
    runtime.update('/collection');
    expect(signal?.aborted).toBe(true);
  });

  it("isole un démarrage en échec (synchrone ou non) : les autres tournent, il est démonté", async () => {
    const sync = probe('sync', 'all', () => {
      throw new Error('boum');
    });
    const async_ = probe('async', 'all', () => Promise.reject(new Error('plouf')));
    const ok = probe('ok', 'all');
    const { runtime, logs } = setup([sync.feature, async_.feature, ok.feature]);

    runtime.update('/pulls');
    await flush();

    expect(runtime.status().map((s) => [s.id, s.state, s.error])).toEqual([
      ['sync', 'failed', 'boum'],
      ['async', 'failed', 'plouf'],
      ['ok', 'mounted', undefined],
    ]);
    expect(sync.events).toEqual(['monte /pulls {}', 'démonte']);
    expect(logs.errors).toHaveLength(2);
  });

  it("ne réessaie une fonctionnalité en échec qu'en changeant de page", () => {
    let attempts = 0;
    const fragile = probe('fragile', ['/marketplace/:id'], () => {
      attempts++;
      throw new Error('boum');
    });
    const other = probe('autre', 'all');
    const { runtime } = setup([fragile.feature, other.feature]);

    runtime.update('/marketplace/a1');
    runtime.setEnabled('autre', false);
    expect(attempts).toBe(1);

    runtime.update('/marketplace/b2');
    expect(attempts).toBe(2);
  });

  it("respecte l'activation : désactivée = démontée et jamais montée", () => {
    const fiche = probe('fiche', 'all');
    const { runtime } = setup([fiche.feature], ['fiche']);

    runtime.update('/pulls');
    expect(fiche.events).toEqual([]);
    expect(runtime.status()[0]?.state).toBe('off');

    runtime.setEnabled('fiche', true);
    expect(fiche.events).toEqual(['monte /pulls {}']);

    runtime.setEnabled('fiche', false);
    expect(fiche.events).toEqual(['monte /pulls {}', 'démonte']);
  });

  it('indique « idle » pour une fonctionnalité active hors de ses pages', () => {
    const fiche = probe('fiche', ['/marketplace/:id']);
    const { runtime } = setup([fiche.feature]);
    runtime.update('/pulls');
    expect(runtime.status()[0]?.state).toBe('idle');
  });

  it('refuse deux fonctionnalités de même identifiant, et un identifiant inconnu', () => {
    const a = probe('a', 'all');
    expect(() => setup([a.feature, a.feature])).toThrow('fonctionnalité en double : a');
    const { runtime } = setup([a.feature]);
    expect(() => runtime.setEnabled('zz', true)).toThrow('fonctionnalité inconnue : zz');
  });

  it("exécute tout de suite une action de nettoyage ajoutée après le démontage", async () => {
    let ctxRef: FeatureContext | undefined;
    const lent = probe('lent', ['/pulls'], async (ctx) => {
      ctxRef = ctx;
      await flush();
    });
    const { runtime } = setup([lent.feature]);
    runtime.update('/pulls');
    runtime.update('/collection');

    let cleaned = false;
    ctxRef?.onDispose(() => {
      cleaned = true;
    });
    await flush();
    expect(cleaned).toBe(true);
  });
});
