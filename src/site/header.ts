/**
 * En-tête du site : le bouton du solde (ouvre la boutique) existe en deux exemplaires,
 * barre du haut sur mobile (`md:hidden fixed top-0 …`) et boîte fixe en haut à droite sur
 * ordinateur (`hidden md:block fixed top-0 right-0 … pointer-events-none`, bouton en
 * `pointer-events-auto`). Relevé le 29/09/2026.
 */
export const BALANCE_BUTTON = 'button[aria-label="Ouvrir la boutique WikiBidous"]';

export function findBalanceButtons(root: ParentNode = document): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(BALANCE_BUTTON)];
}

/** Bas du bouton du solde affiché, en pixels depuis le haut de l'écran ; `undefined` s'il est caché. */
export function balanceBottom(doc: Document = document): number | undefined {
  let bottom: number | undefined;
  for (const button of findBalanceButtons(doc)) {
    const rect = button.getBoundingClientRect();
    if (rect.width > 0 && rect.height > 0) bottom = Math.max(bottom ?? 0, rect.bottom);
  }
  return bottom;
}
