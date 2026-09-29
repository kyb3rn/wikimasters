import { render, type ComponentChild } from 'preact';
import { injectStyle, ROOT_CLASS } from '@/core/dom';
import { ensureBaseStyle } from './theme';

export interface MountOptions {
  /** Démonte et retire l'interface quand il est interrompu. */
  readonly signal: AbortSignal;
  /** Parent du conteneur (par défaut `document.body`, qui doit exister). */
  readonly parent?: Element;
  /** Élément avant lequel insérer le conteneur (dans `parent`). */
  readonly before?: Node | null;
  /** Classe en plus de `wm-root` sur le conteneur. */
  readonly className?: string;
  /**
   * Conteneur transparent pour la mise en page (`display: contents`) : ses enfants se placent
   * comme des enfants directs du parent. Pour glisser un bouton dans une rangée du site.
   */
  readonly inline?: boolean;
}

export interface MountedUi {
  readonly element: HTMLElement;
  /** Redessine avec de nouvelles données (Preact ne met à jour que ce qui change). */
  update(vnode: ComponentChild): void;
}

const INLINE_CSS = `.wm-inline { display: contents; }`;

/**
 * Affiche une interface Preact dans un conteneur `.wm-root` à nous (jamais dans un nœud géré
 * par React). Tout est retiré à l'interruption du signal.
 */
export function mountUi(vnode: ComponentChild, options: MountOptions): MountedUi {
  ensureBaseStyle();
  if (options.inline) injectStyle('ui-inline', INLINE_CSS);
  const container = document.createElement(options.inline ? 'span' : 'div');
  container.className = [ROOT_CLASS, options.inline && 'wm-inline', options.className].filter(Boolean).join(' ');
  const parent = options.parent ?? document.body;
  parent.insertBefore(container, options.before ?? null);
  render(vnode, container);
  options.signal.addEventListener(
    'abort',
    () => {
      render(null, container);
      container.remove();
    },
    { once: true },
  );
  return { element: container, update: (next) => render(next, container) };
}
