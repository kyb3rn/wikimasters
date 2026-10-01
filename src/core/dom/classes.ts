/** Classe de toutes nos racines d'interface : l'observateur de DOM ignore ce qui s'y passe. */
export const ROOT_CLASS = 'wm-root';

/**
 * Contenu à nous fait au balisage du site (vignettes de la recherche avancée du marché), dans une racine : l'observateur
 * le suit comme le site, pour que les fonctionnalités qui habillent ce balisage le voient aussi.
 */
export const SITE_LIKE_CLASS = 'wm-site-like';

/**
 * Copie d'une modale qui s'efface après sa fermeture (`ui/modal`) : une image, qu'aucune recherche des modales
 * ouvertes ne doit trouver.
 */
export const GHOST_CLASS = 'wm-modal-ghost';

/**
 * Fond d'une modale du site qu'une fonctionnalité a intégrée à la page (conversation de /dms en colonne) : ce n'est
 * plus une modale (ni fond, ni croix, ni fondu, ni Échap).
 */
export const EMBEDDED_CLASS = 'wm-embedded-modal';

/**
 * Met ou retire une classe sans écrire dans le DOM si rien ne change. `classList.add` réécrit
 * l'attribut même quand la classe est déjà là : dans un rappel de `watchDom`, chaque appel
 * déclencherait une nouvelle mutation, donc un nouvel appel, à chaque image.
 */
export function setClass(element: Element, name: string, on: boolean): void {
  if (element.classList.contains(name) !== on) element.classList.toggle(name, on);
}
