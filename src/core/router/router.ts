import type { Logger } from '@/core/log';

/** Ce dont le routeur a besoin de `window` (remplaçable dans les tests). */
export interface RouterHost {
  readonly history: History;
  readonly location: Location;
  addEventListener(type: 'popstate', listener: () => void): void;
}

export interface Router {
  /** Chemin actuel (`location.pathname`). */
  readonly path: string;
  /** Appelé après chaque changement de chemin : navigation du site (SPA) ou retour arrière. */
  onChange(listener: (path: string) => void, options?: { signal?: AbortSignal }): void;
}

/**
 * Suit la navigation du site. Next.js change de page sans recharger (`history.pushState`) :
 * on enveloppe `pushState` / `replaceState` et on écoute `popstate`. Seul le chemin compte,
 * un changement de `?…` ou de `#…` seul n'est pas signalé.
 */
export function createRouter(host: RouterHost, log: Logger): Router {
  let path = host.location.pathname;
  const listeners = new Set<(path: string) => void>();

  function check(): void {
    const next = host.location.pathname;
    if (next === path) return;
    path = next;
    for (const listener of [...listeners]) {
      try {
        listener(next);
      } catch (error) {
        log.error('écouteur de navigation en échec', error);
      }
    }
  }

  const history = host.history;
  for (const method of ['pushState', 'replaceState'] as const) {
    const original = history[method].bind(history);
    history[method] = (...args) => {
      original(...args);
      check();
    };
  }
  host.addEventListener('popstate', check);

  return {
    get path() {
      return path;
    },
    onChange(listener, options) {
      const signal = options?.signal;
      if (signal?.aborted) return;
      listeners.add(listener);
      signal?.addEventListener('abort', () => listeners.delete(listener), { once: true });
    },
  };
}
