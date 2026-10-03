import { removeStyle, setHidden, unhideAll, whenBody, writeStyle } from '@/core/dom';
import type { Logger } from '@/core/log';
import type { Listeners } from '@/core/listeners';
import type { FeatureCatalog, FeatureContext } from './types';

/** Page affichée, tenue par le runtime. */
export interface RouteSource {
  current(): string;
  readonly changes: Listeners<[route: string]>;
}

/** Contexte d'une fonctionnalité montée : tout ce qu'il pose est retiré à l'interruption de `signal`. */
export function createContext(
  id: string,
  signal: AbortSignal,
  log: Logger,
  catalog: FeatureCatalog,
  route: RouteSource,
): FeatureContext {
  function onDispose(action: () => void): void {
    const run = () => {
      try {
        action();
      } catch (error) {
        log.error('nettoyage en échec', error);
      }
    };
    if (signal.aborted) run();
    else signal.addEventListener('abort', run, { once: true });
  }

  /** Contenu voulu de chaque feuille, par identifiant : le dernier appel l'emporte, même posé plus tard. */
  const styles = new Map<string, string>();
  let hides = false;

  return {
    log,
    signal,
    catalog,
    onDispose,
    ready: async () => (await whenBody(signal)) !== undefined,
    style(css, name) {
      if (signal.aborted) return;
      const styleId = name ? `${id}-${name}` : id;
      const known = styles.has(styleId);
      styles.set(styleId, css);
      if (document.head) writeStyle(styleId, css);
      else if (!known) {
        // Sans `<head>`, elle irait directement dans `<html>`, que Next.js rend lui-même : posée dès `<body>`.
        void whenBody(signal).then((body) => {
          const latest = styles.get(styleId);
          if (body && latest !== undefined) writeStyle(styleId, latest);
        });
      }
      if (!known) onDispose(() => removeStyle(styleId));
    },
    hide(element, hidden = true) {
      if (signal.aborted) return;
      if (hidden && !hides) {
        hides = true;
        onDispose(() => unhideAll(id));
      }
      setHidden(element, id, hidden);
    },
    route: () => route.current(),
    onRouteChange(listener) {
      route.changes.on(listener, { signal });
    },
  };
}
