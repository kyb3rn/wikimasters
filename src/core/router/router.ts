import { createListeners } from '@/core/listeners';
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
  const listeners = createListeners<[path: string]>(log, 'écouteur de navigation');

  function check(): void {
    const next = host.location.pathname;
    if (next === path) return;
    path = next;
    listeners.emit(next);
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
    onChange: (listener, options) => listeners.on(listener, options),
  };
}
