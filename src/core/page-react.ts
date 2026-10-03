import { isRecord } from '@/core/guards';
import type { ProvidedContext } from '@/core/react';

/*
 * React de la page, celui du site, trouvé parmi ses modules instanciés (`PageModules.loaded`) : de quoi rendre un de
 * ses composants hors de son arbre, dans une racine à nous. Une racine à part ne voit pas les contextes de l'arbre
 * du site (session, réglages…) : on les lui refournit (`providedContexts`), valeurs du moment de l'ouverture.
 */

interface SiteReact {
  createElement(type: unknown, props: Record<string, unknown> | null, ...children: unknown[]): unknown;
}

interface SiteRoot {
  render(element: unknown): void;
  unmount(): void;
}

interface SiteReactDom {
  createRoot(container: Element, options?: Record<string, unknown>): SiteRoot;
}

export interface PageReact {
  readonly react: SiteReact;
  readonly dom: SiteReactDom;
}

const isReact = (exports: Record<string, unknown>): boolean =>
  typeof exports.createElement === 'function' &&
  typeof exports.createContext === 'function' &&
  typeof exports.useState === 'function';

// `react-dom` seul (portails) n'a pas `createRoot` depuis React 19 : seul `react-dom/client` a les deux.
const isReactDomClient = (exports: Record<string, unknown>): boolean =>
  typeof exports.createRoot === 'function' && typeof exports.hydrateRoot === 'function';

export function findPageReact(modules: Iterable<unknown>): PageReact | undefined {
  let react: SiteReact | undefined;
  let dom: SiteReactDom | undefined;
  for (const exports of modules) {
    if (!isRecord(exports)) continue;
    if (!react && isReact(exports)) react = exports as unknown as SiteReact;
    if (!dom && isReactDomClient(exports)) dom = exports as unknown as SiteReactDom;
    if (react && dom) return { react, dom };
  }
  return undefined;
}

export interface PageComponentOptions {
  /** Contextes à refournir, du plus lointain au plus proche. */
  readonly contexts?: readonly ProvidedContext[];
  /** Erreur non rattrapée pendant un rendu (React 19 : l'arbre est alors retiré). */
  readonly onError?: (error: unknown) => void;
}

export interface PageComponentHandle {
  /** Rend le composant avec d'autres props (sous les mêmes contextes). */
  update(props: Record<string, unknown>): void;
  /** Retire le composant (à la tâche suivante : jamais pendant un rendu de React). */
  unmount(): void;
}

/**
 * Rend `component(props)` avec le React de la page, dans une racine à nous sur un nœud détaché : à réserver aux
 * composants qui se rendent en portail (fenêtres du site, dans `body`).
 */
export function renderPageComponent(
  page: PageReact,
  component: unknown,
  props: Record<string, unknown>,
  { contexts = [], onError }: PageComponentOptions = {},
): PageComponentHandle {
  const root = page.dom.createRoot(document.createElement('div'), {
    onUncaughtError: (error: unknown) => onError?.(error),
  });
  const element = (current: Record<string, unknown>) => {
    let tree = page.react.createElement(component, current);
    for (const { type, value } of [...contexts].reverse()) tree = page.react.createElement(type, { value }, tree);
    return tree;
  };
  root.render(element(props));
  let mounted = true;
  return {
    update(next) {
      if (mounted) root.render(element(next));
    },
    unmount() {
      if (!mounted) return;
      mounted = false;
      setTimeout(() => root.unmount(), 0);
    },
  };
}
