/*
 * Menus d'onglets du site (code du 30/09/2026), deux allures :
 * - soulignés (marché, profil d'un joueur, échanges) : rangée `flex border-b border-[var(--color-border)]`,
 *   onglets `py-3 text-sm font-medium`, choisi `text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]`,
 *   les autres `text-[var(--color-foreground)]/50 hover:text-[var(--color-foreground)]` ;
 * - en segments (guilde, qu'on en ait une ou non) : cadre `flex gap-1 bg-[var(--color-surface-light)] rounded-xl
 *   p-1`, onglets `flex-1 py-2 rounded-lg text-sm font-medium`, choisi `bg-[var(--color-accent)]
 *   text-[var(--color-accent-foreground)]`, les autres comme les soulignés.
 */

/** Onglet en segment : il partage la largeur du cadre avec les autres. */
const SEGMENT_TAB = 'button.flex-1.rounded-lg';

/**
 * Onglet choisi d'un menu en segments, en sélecteur CSS : React change ses classes au clic, un style qui s'y accroche
 * suit sans attendre le script.
 */
export const ACTIVE_SEGMENT_TAB = 'button[class~="bg-[var(--color-accent)]"]';

/** Menus d'onglets en segments de la page. */
export function findSegmentTabBars(root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>('div.p-1.rounded-xl')].filter(
    (bar) => bar.childElementCount >= 2 && [...bar.children].every((tab) => tab.matches(SEGMENT_TAB)),
  );
}
