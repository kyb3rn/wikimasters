import { textOf } from '@/core/text';
import { CARD_CELL } from '@/site/cards';
import { hasIcon, isOwn } from '@/site/dom';

/*
 * Mode sélection du site, le même dans la Collection et Toutes les cartes (code du site du 10/10/2026 : composants
 * partagés `BulkSelectionToolbar` et `SelectionMarker`) :
 * - « Sélectionner » / « Quitter la sélection » (lucide `square-check-big` / `x`) à droite du titre `h1`, dans sa
 *   rangée `div.justify-between`. Entrer ou sortir vide la sélection.
 * - En sélection, un clic sur une carte la coche ou la décoche. Chaque case (`CARD_CELL`) reçoit après sa face un
 *   calque (`SELECTION_OVERLAY` : `div.pointer-events-none.absolute.inset-0.z-10.rounded-2xl`, anneau d'accent
 *   `ring-4` si la carte est cochée) et une case à cocher dans le coin haut droit (`FACE_SELECTION_BOX`).
 * - Barre fixe en bas (portail dans `body`, `div.fixed.bottom-4.z-[80] … card-frame`, calée en style sur la largeur
 *   de `<main>`, 768 px au plus) : « n cartes sélectionnées » (« Actualisation… » et une roue pendant un chargement),
 *   puis les boutons de la page, le premier « Tout sélectionner (page) » / « Désélectionner la page »
 *   (`square-check-big` / `square`) ; sous la rangée, l'erreur de la dernière action.
 */

/** Calque du mode sélection, sur toute la case : anneau d'accent si la carte est cochée. */
export const SELECTION_OVERLAY = 'div.pointer-events-none.absolute.inset-0';
/**
 * Signet de Toutes les cartes en sélection, sur une carte de ma liste de souhaits : à côté de la face dans sa case,
 * dans le coin haut gauche (`span.pointer-events-none.absolute.top-1.5.left-1.5.z-30.size-6`), à 6 px du coin.
 */
export const SELECTION_BADGE = 'span.absolute.top-1\\.5.left-1\\.5';

export interface SelectionToggle {
  readonly button: HTMLButtonElement;
  /** Mode sélection actif (le bouton est « Quitter la sélection »). */
  readonly active: boolean;
}

/** Bouton du site qui entre dans le mode sélection ou en sort, à droite du titre de la page. */
export function findSelectionToggle(doc: Document = document): SelectionToggle | undefined {
  for (const heading of doc.querySelector('main')?.querySelectorAll('h1') ?? []) {
    const button = heading.closest('div.justify-between')?.querySelector<HTMLButtonElement>(':scope > button');
    if (!button || isOwn(button)) continue;
    if (hasIcon(button, 'square-check-big')) return { button, active: false };
    if (hasIcon(button, 'x')) return { button, active: true };
  }
  return undefined;
}

export interface SelectionMode {
  readonly active: boolean;
  /** Le site ne laisse pas entrer en sélection (Toutes les cartes : aucune carte). */
  readonly disabled: boolean;
  /** Entre dans le mode ou en sort, comme le bouton du site. */
  toggle(): void;
}

/** Mode sélection d'après le bouton du site, cliqué comme par l'utilisateur. */
export function siteSelectionMode(doc: Document = document): SelectionMode | undefined {
  const site = findSelectionToggle(doc);
  return site && { active: site.active, disabled: site.button.disabled, toggle: () => site.button.click() };
}

export interface SelectionBar {
  readonly root: HTMLElement;
  /** Rangée du compte et des boutons. */
  readonly row: HTMLElement;
  /** Cartes sélectionnées ; `undefined` pendant « Actualisation… ». */
  readonly count: number | undefined;
  /** « Tout sélectionner (page) », ou « Désélectionner la page » quand toute la page l'est. */
  readonly selectPage: HTMLButtonElement | undefined;
  readonly pageSelected: boolean;
  /** Les autres boutons de la page, dans l'ordre. */
  readonly actions: readonly HTMLButtonElement[];
  /** Message d'erreur sous la rangée (dernière action refusée). */
  readonly error: HTMLElement | undefined;
}

export function findSelectionBar(doc: Document = document): SelectionBar | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>('body > div.fixed.bottom-4.card-frame')) {
    // Nos interfaces peuvent s'y ajouter (`.wm-root`) : la rangée du site est son premier enfant à lui.
    const row = [...root.children].find((child) => !isOwn(child));
    if (!(row instanceof HTMLElement) || !/sélectionnée|Actualisation/.test(textOf(row.firstElementChild))) continue;
    const buttons = [...row.querySelectorAll<HTMLButtonElement>('button')];
    const selectPage = buttons.find((button) => hasIcon(button, 'square-check-big', 'square'));
    const number = row.firstElementChild?.querySelector('span.font-semibold');
    const count = number ? Number.parseInt(textOf(number), 10) : Number.NaN;
    return {
      root,
      row,
      count: Number.isInteger(count) ? count : undefined,
      selectPage,
      pageSelected: !!selectPage && hasIcon(selectPage, 'square') && !hasIcon(selectPage, 'square-check-big'),
      actions: buttons.filter((button) => button !== selectPage),
      error: root.querySelector<HTMLElement>(':scope > p.text-red-500') ?? undefined,
    };
  }
  return undefined;
}

/** Calque d'une carte de la grille en sélection : anneau d'accent (`ring-4`) si elle est cochée. */
export interface SelectionMark {
  readonly overlay: HTMLElement;
  readonly selected: boolean;
}

/** Calque de sélection de la case d'une face de la grille (hors sélection : aucun). Le clic de la carte est sur sa face. */
export function selectionMarkOf(face: HTMLElement): SelectionMark | undefined {
  const overlay = face.closest(CARD_CELL)?.querySelector<HTMLElement>(`:scope > ${SELECTION_OVERLAY}`);
  return overlay ? { overlay, selected: overlay.classList.contains('ring-4') } : undefined;
}
