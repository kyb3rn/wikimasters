/** Clic gauche sans Ctrl, Maj, Alt ni Méta : avec l'une d'elles (ou le bouton du milieu), le navigateur ouvre un onglet. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
}

/** Le système demande moins d'animations. */
export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/** Saisie en cours (champ, zone de texte, liste, texte modifiable) : les touches servent au texte, pas aux raccourcis. */
export function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false;
  return target.isContentEditable || ['INPUT', 'TEXTAREA', 'SELECT'].includes(target.tagName);
}
