import { ROOT_CLASS } from '@/core/dom';

/** Nœud d'une de nos interfaces (dans un `.wm-root`), pas du site. */
export function isOwn(node: Node): boolean {
  const element = node instanceof Element ? node : node.parentElement;
  return Boolean(element?.closest(`.${ROOT_CLASS}`));
}

/** Boutons du site sous `root`, sans les nôtres. */
export function siteButtons(root: ParentNode): HTMLButtonElement[] {
  return [...root.querySelectorAll('button')].filter((button) => !isOwn(button));
}

/**
 * Contient-il une de ces icônes lucide (`svg.lucide-<nom>`) ? Le site rend ses icônes avec lucide : un bouton se
 * reconnaît à la sienne mieux qu'à son texte, que le script peut avoir changé. Plusieurs noms pour les alias
 * (`trash-2`, `trash2`).
 */
export function hasIcon(element: ParentNode, ...names: readonly string[]): boolean {
  return names.some((name) => element.querySelector(`svg.lucide-${name}`) !== null);
}
