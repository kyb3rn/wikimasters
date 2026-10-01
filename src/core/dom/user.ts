/** Clic gauche sans Ctrl, Maj, Alt ni Méta : avec l'une d'elles (ou le bouton du milieu), le navigateur ouvre un onglet. */
export function isPlainClick(event: MouseEvent): boolean {
  return event.button === 0 && !event.ctrlKey && !event.shiftKey && !event.altKey && !event.metaKey;
}

/** Le système demande moins d'animations. */
export function prefersReducedMotion(): boolean {
  return matchMedia('(prefers-reduced-motion: reduce)').matches;
}
