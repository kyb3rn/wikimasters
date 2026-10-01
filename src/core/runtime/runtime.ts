import { createListeners } from '@/core/listeners';
import { errorMessage, type Logger } from '@/core/log';
import { matchRoute } from '@/core/router';
import { createContext } from './context';
import type { Feature, FeatureCatalog, FeatureEntry, FeatureStatus } from './types';

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
  const listeners = createListeners(options.createLogger('fonctionnalités'), 'écouteur du catalogue');
  let currentPath: string | undefined;

  const isEnabled = (feature: Feature) => feature.required === true || options.isEnabled(feature);

  /** Clé de la page pour la fonctionnalité (motif reconnu et ses paramètres) : même clé = pas de remontage. */
  function routeKey(feature: Feature, path: string): string | undefined {
    if (feature.routes === 'all') return '*';
    for (const pattern of feature.routes) {
      const params = matchRoute(pattern, path);
      if (params) return `${pattern} ${JSON.stringify(params)}`;
    }
    return undefined;
  }

  function unmount(id: string): void {
    const entry = mounted.get(id);
    if (!entry) return;
    mounted.delete(id);
    entry.controller.abort();
  }

  function mount(feature: Feature, key: string): void {
    const controller = new AbortController();
    const log = options.createLogger(feature.id);
    mounted.set(feature.id, { key, controller });
    failures.delete(feature.id);
    const ctx = createContext(feature.id, controller.signal, log, catalog);

    const fail = (error: unknown) => {
      log.error('échec du démarrage', error);
      failures.set(feature.id, { key, message: errorMessage(error) });
      if (mounted.get(feature.id)?.controller === controller) unmount(feature.id);
      listeners.emit();
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
      const key = isEnabled(feature) ? routeKey(feature, path) : undefined;
      const current = mounted.get(feature.id);
      if (current && current.key === key) continue;
      if (current) unmount(feature.id);
      if (key === undefined) {
        failures.delete(feature.id);
        continue;
      }
      // Échec sur cette même page : pas de nouvel essai avant d'en changer.
      if (failures.get(feature.id)?.key === key) continue;
      mount(feature, key);
    }
    listeners.emit();
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
    onChange: (listener, listenOptions) => listeners.on(listener, listenOptions),
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
