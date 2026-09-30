/**
 * Modales du site (relevé du 29/09/2026, `docs/site.md` § Modales). Pas de composant commun : chacune est un
 * `div.fixed.inset-0.z-…` (portail dans `body` ou enfant d'une autre modale) qui ferme au clic sur le fond,
 * avec un cadre qui arrête le clic. Leur fermeture varie : croix ronde dans le coin (modale de carte), petite
 * croix dans une barre de titre, SVG maison sans nom (vitrine du profil), texte « Fermer » à côté du titre
 * (Modifier la guilde), ou rien (confirmations, qui ont « Annuler »).
 *
 * Le fond ne sert jamais à fermer une modale à la place de l'utilisateur : dans l'invitation de guilde,
 * un clic sur le fond **décline** l'invitation.
 */
const OVERLAY = 'div.fixed.inset-0';

export interface SiteModal {
  readonly overlay: HTMLElement;
  /** Ce qui assombrit la page : l'overlay, ou un calque à part (`absolute inset-0`, Signaler, Faire appel). */
  readonly shade: HTMLElement;
  /** Absent pour une roue de chargement seule. */
  readonly frame: HTMLElement | undefined;
  /** Fermeture du site : croix, « Fermer » à côté du titre, sinon « Compris » (aide de /pulls). */
  readonly close: HTMLButtonElement | undefined;
  /** « Compris » en bas d'une aide (/pulls, batailles) : en trop à côté d'une croix. */
  readonly dismiss: HTMLButtonElement | undefined;
}

// Tracés des croix du site : lucide `x`, heroicons (conversation, Inviter des amis), vitrine du profil.
const CROSS_PATHS = new Set(['M18 6 6 18', 'm6 6 12 12', 'M6 18L18 6M6 6l12 12', 'M2 2l14 14M16 2L2 16']);

const text = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Nos interfaces (`.wm-root`) ne font pas partie de la modale. */
const isOwn = (element: Element) => element.closest('.wm-root') !== null;

function ownButtons(overlay: HTMLElement): HTMLButtonElement[] {
  return [...overlay.querySelectorAll('button')].filter((button) => button.closest(OVERLAY) === overlay && !isOwn(button));
}

/** Bouton posé à côté du titre (même parent qu'un `h1`-`h3`, ou que le bloc qui le contient). */
function besideTitle(button: Element): boolean {
  return !!button.parentElement?.querySelector(':scope > :is(h1, h2, h3), :scope > * > :is(h1, h2, h3)');
}

function drawsCross(button: Element): boolean {
  const paths = [...button.querySelectorAll('svg path')].map((path) => path.getAttribute('d') ?? '');
  return paths.length > 0 && paths.every((d) => CROSS_PATHS.has(d));
}

function findClose(buttons: readonly HTMLButtonElement[]): HTMLButtonElement | undefined {
  return (
    buttons.find((button) => button.getAttribute('aria-label')?.startsWith('Fermer')) ??
    buttons.find((button) => text(button) === 'Fermer' && besideTitle(button)) ??
    buttons.find((button) => !button.hasAttribute('aria-label') && text(button) === '' && drawsCross(button) && besideTitle(button))
  );
}

export function findSiteModals(doc: Document = document): SiteModal[] {
  const modals: SiteModal[] = [];
  for (const overlay of doc.querySelectorAll<HTMLElement>(OVERLAY)) {
    // Feux d'artifice de /pulls, et nos propres éléments.
    if (overlay.classList.contains('pointer-events-none') || isOwn(overlay)) continue;
    const children = [...overlay.children].filter((child): child is HTMLElement => child instanceof HTMLElement && !isOwn(child));
    const layer = children.find((child) => child.matches('div.absolute.inset-0'));
    const frame = children.find((child) => child !== layer);
    const buttons = frame ? ownButtons(overlay) : [];
    const dismiss = buttons.find((button) => /^Compris\b/.test(text(button)));
    modals.push({ overlay, shade: layer ?? overlay, frame, close: findClose(buttons) ?? dismiss, dismiss });
  }
  return modals;
}

/** Croix ronde dans le coin (modale de carte, mise aux enchères…) : le modèle, rien à changer. */
export function isCornerCross(button: HTMLButtonElement): boolean {
  return ['absolute', 'rounded-full', 'h-9', 'w-9'].every((name) => button.classList.contains(name));
}

/**
 * Ce qu'Échap peut cliquer pour quitter la modale comme l'utilisateur le ferait : sa fermeture, sinon « Annuler ».
 * Rien d'autre (surtout pas le fond : voir plus haut).
 */
export function escapeTarget(modal: SiteModal): HTMLButtonElement | undefined {
  return modal.close ?? ownButtons(modal.overlay).find((button) => text(button) === 'Annuler');
}

/** Modale du dessus parmi celles affichées (les modales du site cachées par nos fonctionnalités ne comptent pas). */
export function topSiteModal(doc: Document = document): SiteModal | undefined {
  let top: { modal: SiteModal; z: number } | undefined;
  for (const modal of findSiteModals(doc)) {
    if (!modal.overlay.checkVisibility({ visibilityProperty: true })) continue;
    const z = Number.parseInt(getComputedStyle(modal.overlay).zIndex, 10) || 0;
    // À égalité, la dernière du document est dessus (les modales imbriquées viennent après leur parente).
    if (!top || z >= top.z) top = { modal, z };
  }
  return top?.modal;
}
