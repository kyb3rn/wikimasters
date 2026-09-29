import { errorMessage, type Logger } from '@/core/log';
import { matchRoute, type RouteParams } from '@/core/router';
import type { Feature, FeatureCatalog, FeatureContext, FeatureEntry, FeatureStatus } from './types';

export interface RuntimeOptions {
  readonly features: readonly Feature[];
  /** Choix de l'utilisateur (sans tenir compte de `required`). */
  isEnabled(feature: Feature): boolean;
  saveEnabled(id: string, enabled: boolean): void;
  createLogger(scope: string): Logger;
}

export interface Runtime {
  /** Monte et démonte les fonctionnalités pour ce chemin. */
  update(path: string): void;
  /** Réapplique les choix d'activation (changés ailleurs : autre onglet…) sur la page actuelle. */
  refresh(): void;
  setEnabled(id: string, enabled: boolean): void;
  status(): FeatureStatus[];
  readonly catalog: FeatureCatalog;
}

interface Match {
  /** Identifie la page pour la fonctionnalité : même clé = pas de remontage. */
  readonly key: string;
  readonly params: RouteParams;
}

interface Mounted {
  readonly key: string;
  readonly controller: AbortController;
}

/**
 * Cycle de vie des fonctionnalités. Chacune est isolée : une erreur à son démarrage
 * est journalisée, la fonctionnalité est démontée, les autres continuent.
 */
export function createRuntime(options: RuntimeOptions): Runtime {
  const { features } = options;
  const byId = new Map<string, Feature>();
  for (const feature of features) {
    if (byId.has(feature.id)) throw new Error(`fonctionnalité en double : ${feature.id}`);
    byId.set(feature.id, feature);
  }

  const mounted = new Map<string, Mounted>();
  const failures = new Map<string, { key: string; message: string }>();
  const listeners = new Set<() => void>();
  let currentPath: string | undefined;

  const isEnabled = (feature: Feature) => feature.required === true || options.isEnabled(feature);

  function notify(): void {
    for (const listener of [...listeners]) {
      try {
        listener();
      } catch {
        // Un écouteur défaillant n'empêche pas les autres d'être prévenus.
      }
    }
  }

  function resolve(feature: Feature, path: string): Match | undefined {
    if (feature.routes === 'all') return { key: '*', params: {} };
    for (const pattern of feature.routes) {
      const params = matchRoute(pattern, path);
      if (params) return { key: `${pattern} ${JSON.stringify(params)}`, params };
    }
    return undefined;
  }

  function unmount(id: string): void {
    const entry = mounted.get(id);
    if (!entry) return;
    mounted.delete(id);
    entry.controller.abort();
  }

  function mount(feature: Feature, path: string, match: Match): void {
    const controller = new AbortController();
    const { signal } = controller;
    const log = options.createLogger(feature.id);
    mounted.set(feature.id, { key: match.key, controller });
    failures.delete(feature.id);

    const ctx: FeatureContext = {
      id: feature.id,
      log,
      signal,
      path,
      params: match.params,
      catalog,
      onDispose(action) {
        const run = () => {
          try {
            action();
          } catch (error) {
            log.error('nettoyage en échec', error);
          }
        };
        if (signal.aborted) run();
        else signal.addEventListener('abort', run, { once: true });
      },
    };

    const fail = (error: unknown) => {
      log.error('échec du démarrage', error);
      failures.set(feature.id, { key: match.key, message: errorMessage(error) });
      if (mounted.get(feature.id)?.controller === controller) unmount(feature.id);
      notify();
    };

    try {
      Promise.resolve(feature.mount(ctx)).catch(fail);
    } catch (error) {
      fail(error);
    }
  }

  function update(path: string): void {
    currentPath = path;
    for (const feature of features) {
      const match = isEnabled(feature) ? resolve(feature, path) : undefined;
      const current = mounted.get(feature.id);
      if (current && current.key === match?.key) continue;
      if (current) unmount(feature.id);
      if (!match) {
        failures.delete(feature.id);
        continue;
      }
      // Échec sur cette même page : pas de nouvel essai avant d'en changer.
      if (failures.get(feature.id)?.key === match.key) continue;
      mount(feature, path, match);
    }
    notify();
  }

  function refresh(): void {
    if (currentPath !== undefined) update(currentPath);
  }

  function setEnabled(id: string, enabled: boolean): void {
    const feature = byId.get(id);
    if (!feature) throw new Error(`fonctionnalité inconnue : ${id}`);
    if (feature.required) return;
    options.saveEnabled(id, enabled);
    if (!enabled) failures.delete(id);
    refresh();
  }

  function entry(feature: Feature): FeatureEntry {
    const enabled = isEnabled(feature);
    if (!enabled) return { feature, enabled, state: 'off' };
    if (mounted.has(feature.id)) return { feature, enabled, state: 'mounted' };
    const failure = failures.get(feature.id);
    if (failure) return { feature, enabled, state: 'failed', error: failure.message };
    return { feature, enabled, state: 'idle' };
  }

  const catalog: FeatureCatalog = {
    list: () => features.map(entry),
    setEnabled,
    onChange(listener, listenOptions) {
      const signal = listenOptions?.signal;
      if (signal?.aborted) return;
      listeners.add(listener);
      signal?.addEventListener('abort', () => listeners.delete(listener), { once: true });
    },
  };

  return {
    update,
    refresh,
    setEnabled,
    catalog,
    status() {
      return features.map((feature): FeatureStatus => {
        const { state, error } = entry(feature);
        return { id: feature.id, name: feature.name, state, ...(error !== undefined && { error }) };
      });
    },
  };
}
