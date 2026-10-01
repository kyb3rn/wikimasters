import { injectStyle } from './style';

/**
 * Propriétaires qui masquent l'élément, séparés par des espaces. Un attribut à nous plutôt qu'une classe : React
 * réécrit `class` quand il change la sienne, pas un attribut qu'il ne connaît pas. Hors de l'`attributeFilter` de
 * `watchDom` : masquer ne relance pas la synchronisation.
 */
const ATTRIBUTE = 'data-wm-hidden';

/**
 * Masque un élément (`display: none`) au nom de `owner`, ou le rend (`hidden` faux). Plusieurs propriétaires
 * possibles : l'élément reste masqué tant que l'un d'eux le masque. N'écrit dans le DOM que si ça change.
 */
export function setHidden(element: Element, owner: string, hidden: boolean): void {
  const owners = ownersOf(element);
  if (owners.includes(owner) === hidden) return;
  const next = hidden ? [...owners, owner] : owners.filter((name) => name !== owner);
  if (next.length === 0) element.removeAttribute(ATTRIBUTE);
  else element.setAttribute(ATTRIBUTE, next.join(' '));
  if (hidden) injectStyle('hidden', `[${ATTRIBUTE}] { display: none !important; }`);
}

/** Rend tous les éléments de la page masqués au nom de `owner`. */
export function unhideAll(owner: string): void {
  for (const element of document.querySelectorAll(`[${ATTRIBUTE}]`)) setHidden(element, owner, false);
}

function ownersOf(element: Element): string[] {
  return (element.getAttribute(ATTRIBUTE) ?? '').split(' ').filter((name) => name !== '');
}
