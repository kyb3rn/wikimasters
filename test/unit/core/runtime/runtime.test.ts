import { afterEach, describe, expect, it, vi } from 'vitest';
import { setHidden } from '@/core/dom';
import { createRuntime, type Feature, type FeatureContext } from '@/core/runtime';
import { flush, memoryLogger } from '../../support';
import { arrive, asElement, FakeElement, installFakeDocument, installFakeObservers, styleText } from '../fake-dom';

/** Chemin passé au dernier `runtime.update` : noté au montage. */
let page = '';

/** Fonctionnalité de test qui note ses montages (et la page) et ses démontages. */
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
      events.push(`monte ${page}`);
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
    isEnabled: (f) => choices.get(f.id) ?? true,
    saveEnabled: (id, enabled) => choices.set(id, enabled),
    createLogger: () => logs,
  });
  const update = runtime.update.bind(runtime);
  runtime.update = (path) => {
    page = path;
    update(path);
  };
  return { runtime, logs, choices };
}

describe('createRuntime', () => {
  it('garde toujours active une fonctionnalité obligatoire, sans pouvoir la désactiver', () => {
    const settings = probe('settings', 'all', undefined, { required: true });
    const { runtime } = setup([settings.feature], ['settings']);

    runtime.update('/pulls');
    runtime.setEnabled('settings', false);

    expect(settings.events).toEqual(['monte /pulls']);
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
    const { runtime, choices } = setup([a.feature]);
    runtime.update('/pulls');
    choices.set('a', false);
    runtime.refresh();
    expect(a.events).toEqual(['monte /pulls', 'démonte']);
  });

  it('monte une fonctionnalité sur ses pages et la démonte ailleurs', () => {
    const fiche = probe('fiche', ['/marketplace/:id']);
    const { runtime } = setup([fiche.feature]);

    runtime.update('/pulls');
    runtime.update('/marketplace/a1');
    runtime.update('/collection');

    expect(fiche.events).toEqual(['monte /marketplace/a1', 'démonte']);
  });

  it('remonte quand les paramètres changent, pas quand ils restent les mêmes', () => {
    const fiche = probe('fiche', ['/marketplace/:id']);
    const { runtime } = setup([fiche.feature]);

    runtime.update('/marketplace/a1');
    runtime.update('/marketplace/a1/');
    runtime.update('/marketplace/b2');

    expect(fiche.events).toEqual(['monte /marketplace/a1', 'démonte', 'monte /marketplace/b2']);
  });

  it('garde montée une fonctionnalité de toutes les pages', () => {
    const partout = probe('partout', 'all');
    const { runtime } = setup([partout.feature]);

    runtime.update('/pulls');
    runtime.update('/collection');

    expect(partout.events).toEqual(['monte /pulls']);
  });

  it("traite une vue (?vue=…) comme une autre page : la page d'origine démontée, celle de la vue montée", () => {
    const collection = probe('collection', ['/collection']);
    const revente = probe('revente', ['/collection?vue=revente']);
    const { runtime } = setup([collection.feature, revente.feature]);

    runtime.update('/collection');
    runtime.update('/collection?vue=revente');
    runtime.update('/collection');

    expect(collection.events).toEqual(['monte /collection', 'démonte', 'monte /collection']);
    expect(revente.events).toEqual(['monte /collection?vue=revente', 'démonte']);
  });

  it('route et onRouteChange : la page affichée, et ses changements tant que la fonctionnalité reste montée', () => {
    const seen: string[] = [];
    let route: (() => string) | undefined;
    const partout = probe('partout', 'all', (ctx) => {
      route = () => ctx.route();
      ctx.onRouteChange((path) => seen.push(path));
    });
    const paquets = probe('paquets', ['/pulls'], (ctx) => ctx.onRouteChange((path) => seen.push(`paquets ${path}`)));
    const { runtime } = setup([partout.feature, paquets.feature]);

    runtime.update('/pulls');
    expect(route?.()).toBe('/pulls');
    runtime.update('/collection');
    runtime.update('/collection');
    runtime.update('/collection?vue=revente');

    expect(route?.()).toBe('/collection?vue=revente');
    expect(seen).toEqual(['/collection', '/collection?vue=revente']);
  });

  it('interrompt le signal au démontage', () => {
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

  it('isole un démarrage en échec (synchrone ou non) : les autres tournent, il est démonté', async () => {
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
    expect(sync.events).toEqual(['monte /pulls', 'démonte']);
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
    expect(fiche.events).toEqual(['monte /pulls']);

    runtime.setEnabled('fiche', false);
    expect(fiche.events).toEqual(['monte /pulls', 'démonte']);
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

  it('exécute tout de suite une action de nettoyage ajoutée après le démontage', async () => {
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

describe('contexte d’une fonctionnalité', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('ready : vrai une fois <body> là, faux si la fonctionnalité a été démontée entre-temps', async () => {
    const doc = installFakeDocument({ body: false });
    const observers = installFakeObservers();
    const results: string[] = [];
    const a = probe('a', ['/pulls'], async (ctx) => void results.push(`a ${await ctx.ready()}`));
    const b = probe('b', 'all', async (ctx) => void results.push(`b ${await ctx.ready()}`));
    const { runtime } = setup([a.feature, b.feature]);
    runtime.update('/pulls');
    runtime.update('/collection');
    await flush();
    expect(results).toEqual(['a false']);

    arrive(doc, 'body');
    observers.mutate();
    await flush();
    expect(results).toEqual(['a false', 'b true']);
  });

  it('style : feuille de la fonctionnalité, remplacée par un appel du même nom, retirée au démontage', () => {
    const doc = installFakeDocument();
    const a = probe('a', ['/pulls'], (ctx) => {
      ctx.style('.x {}');
      ctx.style('.y {}', 'grille');
      ctx.style('.z {}', 'grille');
    });
    const { runtime } = setup([a.feature]);
    runtime.update('/pulls');
    expect(styleText(doc, 'a')).toBe('.x {}');
    expect(styleText(doc, 'a-grille')).toBe('.z {}');
    expect(doc.head?.childNodes).toHaveLength(2);
    runtime.update('/collection');
    expect(doc.head?.childNodes).toHaveLength(0);
  });

  it('style sans <head> : posée dès <body>, avec le dernier contenu ; rien si démontée avant', async () => {
    const doc = installFakeDocument({ head: false, body: false });
    const observers = installFakeObservers();
    const a = probe('a', 'all', (ctx) => {
      ctx.style('.x {}');
      ctx.style('.y {}');
    });
    const b = probe('b', ['/pulls'], (ctx) => ctx.style('.b {}'));
    const { runtime } = setup([a.feature, b.feature]);
    runtime.update('/pulls');
    runtime.update('/collection');
    expect(doc.documentElement.childNodes).toHaveLength(0);

    const head = arrive(doc, 'head');
    arrive(doc, 'body');
    observers.mutate();
    await flush();
    expect(styleText(doc, 'a')).toBe('.y {}');
    expect(head.childNodes).toHaveLength(1);
  });

  it('hide : masque au nom de la fonctionnalité, tout rendu au démontage', () => {
    const doc = installFakeDocument();
    const [x, y] = [new FakeElement('div'), new FakeElement('div')];
    doc.body?.append(x, y);
    setHidden(asElement(y), 'autre', true);
    const a = probe('a', ['/pulls'], (ctx) => {
      ctx.hide(asElement(x));
      ctx.hide(asElement(y));
    });
    const { runtime } = setup([a.feature]);
    runtime.update('/pulls');
    expect([x.getAttribute('data-wm-hidden'), y.getAttribute('data-wm-hidden')]).toEqual(['a', 'autre a']);
    runtime.update('/collection');
    expect([x.getAttribute('data-wm-hidden'), y.getAttribute('data-wm-hidden')]).toEqual([null, 'autre']);
  });
});
