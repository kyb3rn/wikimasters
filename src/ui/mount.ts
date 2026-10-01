import { render, type ComponentChild } from 'preact';
import { childController } from '@/core/async';
import { ROOT_CLASS } from '@/core/dom';
import { cx } from './cx';
import { ensureBaseStyle, INLINE_CLASS } from './theme';

/** Où poser une interface. */
export interface Placement {
  readonly parent: Element;
  /** Juste avant ce nœud. `null` : dernier enfant. Absent (et pas d'`after`) : n'importe où dans `parent`, ajouté à la fin au montage. */
  readonly before?: Node | null;
  /** Juste après ce nœud (exclusif avec `before`). */
  readonly after?: Node;
  /**
   * Conteneur transparent pour la mise en page (`display: contents`) : ses enfants se placent comme des enfants
   * directs du parent. Pour glisser un bouton dans une rangée du site ; aucun style de base ne s'y applique.
   */
  readonly inline?: boolean;
  /** Classe en plus de `wm-root` sur le conteneur. */
  readonly className?: string;
}

export interface MountOptions extends Partial<Placement> {
  /** Démonte et retire l'interface quand il est interrompu. */
  readonly signal: AbortSignal;
}

export interface MountedUi {
  /** Conteneur `.wm-root`, posé une fois pour toutes : si le site le retire ou le déplace, il faut remonter (`createSlot`). */
  readonly element: HTMLElement;
  /** Redessine avec de nouvelles données (Preact ne met à jour que ce qui change). */
  update(vnode: ComponentChild): void;
}

// `Node.ELEMENT_NODE` en dur : `isPlaced` se teste aussi sur des nœuds imités, hors navigateur.
const isElement = (node: Node): node is Element => node.nodeType === 1;

/** Nœud devant lequel insérer le conteneur. */
function insertionPoint({ before, after }: Partial<Placement>): Node | null {
  if (after) return after.nextSibling;
  return before ?? null;
}

/**
 * Affiche une interface Preact dans un conteneur `.wm-root` à nous (jamais dans un nœud géré par React), là où le
 * dit `options` (par défaut à la fin de `document.body`, qui doit exister). Elle n'y est posée qu'une fois : pour
 * la garder à sa place dans une page que React redessine, passer par `createSlot`. Tout est retiré à l'interruption
 * du signal.
 */
export function mountUi(vnode: ComponentChild, options: MountOptions): MountedUi {
  ensureBaseStyle();
  const container = document.createElement(options.inline ? 'span' : 'div');
  container.className = cx(ROOT_CLASS, options.inline && INLINE_CLASS, options.className);
  // Interrompu d'avance (fonctionnalité déjà démontée) : rien n'est posé, rien ne resterait à retirer.
  if (options.signal.aborted) return { element: container, update: () => undefined };
  const parent = options.parent ?? document.body;
  parent.insertBefore(container, insertionPoint(options));
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

/**
 * Le conteneur est-il à l'endroit voulu ? Même parent, et : juste avant `before` (élément suivant s'il s'agit d'un
 * élément, sinon nœud suivant), dernier élément pour `null`, juste après `after` ; n'importe où sans l'un ni l'autre.
 */
export function isPlaced(element: Node, { parent, before, after }: Placement): boolean {
  if (element.parentNode !== parent) return false;
  if (after) return (isElement(after) ? (element as Element).previousElementSibling : element.previousSibling) === after;
  if (before === undefined) return true;
  if (before === null) return (element as Element).nextElementSibling === null;
  return (isElement(before) ? (element as Element).nextElementSibling : element.nextSibling) === before;
}

/** Une interface gardée à sa place dans une page que React redessine (rappel de `watchDom`). */
export interface UiSlot {
  /** Mise à jour si elle est déjà au bon endroit, sinon démontée puis remontée là. */
  render(vnode: ComponentChild, placement: Placement): MountedUi;
  /** Démonte l'interface (elle n'a plus sa place dans la page). */
  clear(): void;
  readonly ui: MountedUi | undefined;
}

interface Mounted {
  readonly ui: MountedUi;
  readonly controller: AbortController;
  readonly inline: boolean;
  readonly className: string | undefined;
}

/** Emplacement d'une interface, démontée à l'interruption de `signal`. */
export function createSlot(signal: AbortSignal): UiSlot {
  let mounted: Mounted | undefined;

  const clear = () => {
    mounted?.controller.abort();
    mounted = undefined;
  };

  return {
    render(vnode, placement) {
      const inline = placement.inline ?? false;
      if (
        mounted &&
        !mounted.controller.signal.aborted &&
        mounted.inline === inline &&
        mounted.className === placement.className &&
        isPlaced(mounted.ui.element, placement)
      ) {
        mounted.ui.update(vnode);
        return mounted.ui;
      }
      clear();
      const controller = childController(signal);
      const ui = mountUi(vnode, { ...placement, signal: controller.signal });
      mounted = { ui, controller, inline, className: placement.className };
      return ui;
    },
    clear,
    get ui() {
      return mounted && !mounted.controller.signal.aborted ? mounted.ui : undefined;
    },
  };
}

/** Plusieurs interfaces gardées à leur place, une par clé (une par carte, par ligne…). */
export interface UiSlots<K> {
  render(key: K, vnode: ComponentChild, placement: Placement): MountedUi;
  clear(key: K): void;
  /** Démonte celles dont la clé ne doit pas être gardée. */
  prune(keep: (key: K) => boolean): void;
  clearAll(): void;
  keys(): K[];
}

/** Emplacements par clé, tous démontés à l'interruption de `signal`. */
export function createSlots<K>(signal: AbortSignal): UiSlots<K> {
  const slots = new Map<K, UiSlot>();

  const clear = (key: K) => {
    slots.get(key)?.clear();
    slots.delete(key);
  };

  signal.addEventListener('abort', () => slots.clear(), { once: true });

  return {
    render(key, vnode, placement) {
      let slot = slots.get(key);
      if (!slot) {
        slot = createSlot(signal);
        slots.set(key, slot);
      }
      return slot.render(vnode, placement);
    },
    clear,
    prune(keep) {
      for (const key of [...slots.keys()]) if (!keep(key)) clear(key);
    },
    clearAll() {
      for (const key of [...slots.keys()]) clear(key);
    },
    keys: () => [...slots.keys()],
  };
}
