import { isRecord } from '@/core/guards';

/*
 * Modules de la page, assemblés par Turbopack (Next.js). Une fois son exécution chargée, son registre
 * (`globalThis.TURBOPACK`, jusque-là un tableau en attente) est un objet `{ push }` qui accepte deux sortes de
 * morceaux : `[chemin, id, fabrique, …]` inscrit des fabriques, `[chemin, { otherChunks, runtimeModuleIds }]` lance
 * des modules inscrits (après une tâche). Un module à nous, lancé ainsi, reçoit le contexte des modules (`e` dans
 * leur code), par lequel on lit ceux du site : `e.M` (fabriques inscrites), `e.c` (modules instanciés), `e.A(id)`
 * (import dynamique : morceaux chargés, puis module visé importé).
 *
 * Les identifiants sont des nombres tirés du chemin des fichiers du site : stables d'un déploiement à l'autre tant
 * que le fichier ne change pas de place, mais rien ne le garantit. On reconnaît plutôt un module à son code.
 */

export type ModuleId = number | string;

interface TurbopackContext {
  i(id: ModuleId): unknown;
  A(id: ModuleId): Promise<unknown>;
  readonly M: Map<ModuleId, unknown>;
  readonly c: Record<string, unknown>;
}

export interface PageModules {
  /** Fabriques inscrites et leur code. */
  sources(): Generator<readonly [ModuleId, string]>;
  /** Exports des modules déjà instanciés. */
  loaded(): Generator<unknown>;
  /** Fabrique inscrite (morceau de code reçu). */
  has(id: ModuleId): boolean;
  /** Import d'un module inscrit (instancié au besoin) : son espace de noms. */
  require(id: ModuleId): unknown;
  /** Import dynamique du site par l'identifiant de son chargeur : l'espace de noms du module visé. */
  load(loaderId: ModuleId): Promise<unknown>;
}

const CHUNK = 'wikimasters';
const TIMEOUT_MS = 2000;

let attempts = 0;
let captured: Promise<PageModules | undefined> | undefined;
const sourceCache = new WeakMap<object, string>();

function isContext(value: unknown): value is TurbopackContext {
  return (
    isRecord(value) &&
    typeof value.i === 'function' &&
    typeof value.A === 'function' &&
    value.M instanceof Map &&
    isRecord(value.c)
  );
}

function sourceOf(factory: object): string {
  let source = sourceCache.get(factory);
  if (source === undefined) {
    source = Function.prototype.toString.call(factory);
    sourceCache.set(factory, source);
  }
  return source;
}

function wrap(context: TurbopackContext): PageModules {
  return {
    *sources() {
      for (const [id, factory] of context.M) {
        if (typeof factory === 'function') yield [id, sourceOf(factory)];
      }
    },
    *loaded() {
      for (const module of Object.values(context.c)) {
        if (isRecord(module)) yield module.exports;
      }
    },
    has: (id) => context.M.has(id),
    require: (id) => context.i(id),
    load: (loaderId) => context.A(loaderId),
  };
}

/**
 * Modules de la page ; `undefined` sans Turbopack (ou pas encore chargé). Le contexte est pris une fois par page :
 * un module lancé ne l'est plus jamais, un nouvel essai en inscrit un autre.
 */
export function pageModules(): Promise<PageModules | undefined> {
  if (captured) return captured;
  const registry: unknown = Reflect.get(globalThis, 'TURBOPACK');
  if (!isRecord(registry) || typeof registry.push !== 'function') return Promise.resolve(undefined);
  const push = registry.push as (chunk: unknown[]) => unknown;
  const id = `${CHUNK}-${++attempts}`;
  const attempt = new Promise<PageModules | undefined>((resolve) => {
    const timer = setTimeout(() => resolve(undefined), TIMEOUT_MS);
    const factory = (context: unknown): void => {
      clearTimeout(timer);
      resolve(isContext(context) ? wrap(context) : undefined);
    };
    try {
      push.call(registry, [CHUNK, id, factory]);
      push.call(registry, [CHUNK, { otherChunks: [], runtimeModuleIds: [id] }]);
    } catch {
      clearTimeout(timer);
      resolve(undefined);
    }
  });
  captured = attempt;
  void attempt.then((modules) => {
    if (!modules && captured === attempt) captured = undefined;
  });
  return attempt;
}
