import { createListeners } from '@/core/listeners';
import type { Logger } from '@/core/log';
import { canonicalQuery } from './match';

/** Ce dont le routeur a besoin de `window` (remplaçable dans les tests). */
export interface RouterHost {
  readonly history: History;
  readonly location: Location;
  addEventListener(type: 'popstate', listener: () => void): void;
}

export interface RouterOptions {
  /**
   * Paramètres d'adresse qui changent la page affichée (vue d'une page : `vue` de `/collection?vue=revente`). Les
   * autres (`?sort=…`, `#…`) ne comptent pas.
   */
  readonly viewKeys?: readonly string[];
}

export interface Router {
  /** Page actuelle : `location.pathname`, suivi de ses paramètres de vue s'il en a (`/collection?vue=revente`). */
  readonly path: string;
  /** Appelé après chaque changement de page : navigation du site (SPA), retour arrière, autre vue. */
  onChange(listener: (path: string) => void, options?: { signal?: AbortSignal }): void;
}

/** Page d'une adresse : son chemin et ses seuls paramètres de vue, dans un ordre fixe (`matchRoute` les compare). */
function routePath(location: Pick<Location, 'pathname' | 'search'>, viewKeys: readonly string[]): string {
  if (viewKeys.length === 0) return location.pathname;
  const params = new URLSearchParams(location.search);
  const views = new URLSearchParams();
  for (const key of viewKeys) for (const value of params.getAll(key)) views.append(key, value);
  const query = canonicalQuery(views);
  return query ? `${location.pathname}?${query}` : location.pathname;
}

/**
 * Suit la navigation du site. Next.js change de page sans recharger (`history.pushState`) : on enveloppe
 * `pushState` / `replaceState` et on écoute `popstate`. Seuls le chemin et les paramètres de vue comptent : un autre
 * tri dans `?…`, ou un `#…`, n'est pas signalé.
 */
export function createRouter(host: RouterHost, log: Logger, options: RouterOptions = {}): Router {
  const viewKeys = options.viewKeys ?? [];
  let path = routePath(host.location, viewKeys);
  const listeners = createListeners<[path: string]>(log, 'écouteur de navigation');

  function check(): void {
    const next = routePath(host.location, viewKeys);
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
    onChange: (listener, listenOptions) => listeners.on(listener, listenOptions),
  };
}
