import { isRecord, isSet, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { currentFiberAncestors, fiberOf, findPropsAbove, type Fiber } from '@/core/react';
import { textOf } from '@/core/text';
import { hasIcon, isOwn } from '@/site/dom';
import { statesAboveRefresh } from '@/site/list-page';
import { SITE_OVERLAY } from '@/site/modals';
import { findCollectionFilters } from './filters';

/**
 * Mode « sélection » de la page Collection (code et captures du site, 29/09/2026).
 *
 * - « Sélectionner » / « Quitter la sélection » : à droite du titre `h1` « Collection » (quand la collection
 *   n'est pas vide) ; lucide `square-check-big` / `x`. Entrer ou sortir vide la sélection.
 * - En sélection, un clic sur une carte la coche (sauf carte en échange). Barre fixe en bas (portail dans
 *   `body`, `div.fixed.bottom-4.z-[80] … card-frame`, calée sur la largeur du contenu) : « n cartes
 *   sélectionnées » (« Actualisation… » avec une roue pendant un chargement ou un changement de filtre),
 *   puis « Tout sélectionner (page) » / « Désélectionner la page » (`square-check-big` / `square`),
 *   « Étiqueter », « Retirer l'étiquette » (deux lucide `tag`), « Défausser (+n) » (`trash-2`, rouge), et
 *   sous la rangée l'erreur de la dernière défausse. Tout est désactivé pendant un chargement.
 * - La sélection est vidée à chaque changement de filtre ou de page, et réduite aux cartes encore affichées
 *   après un rechargement.
 */

export interface SelectionToggle {
  readonly button: HTMLButtonElement;
  /** Mode sélection actif (le bouton est « Quitter la sélection »). */
  readonly active: boolean;
}

/** Bouton du site qui entre dans le mode sélection ou en sort. */
export function findSelectionToggle(doc: Document = document): SelectionToggle | undefined {
  const heading = [...(doc.querySelector('main')?.querySelectorAll('h1') ?? [])].find((h1) => textOf(h1) === 'Collection');
  const button = heading?.parentElement?.querySelector<HTMLButtonElement>(':scope > button');
  if (!button) return undefined;
  if (hasIcon(button, 'square-check-big')) return { button, active: false };
  if (hasIcon(button, 'x')) return { button, active: true };
  return undefined;
}

export interface SelectionState {
  readonly active: boolean;
  /** Entre dans le mode ou en sort, la sélection vidée (comme le bouton du site). */
  setActive(active: boolean): void;
}

/**
 * Mode sélection lu dans l'état de la page : son bouton n'apparaît qu'une fois les compteurs reçus (total
 * non nul), parfois bien après la liste, jamais s'ils échouent ; le mode, lui, ne dépend que de cet état.
 */
export function findSelectionState(doc: Document = document): SelectionState | undefined {
  const row = findCollectionFilters(doc)?.row;
  return row ? selectionStateAmong(currentFiberAncestors(row)) : undefined;
}

export interface SelectionMode {
  readonly active: boolean;
  /** Entre dans le mode ou en sort, comme le bouton du site. */
  toggle(): void;
}

/** Mode sélection : le bouton du site s'il est affiché (cliqué comme par l'utilisateur), sinon l'état de la page. */
export function findSelectionMode(doc: Document = document): SelectionMode | undefined {
  const site = findSelectionToggle(doc);
  if (site) return { active: site.active, toggle: () => site.button.click() };
  const state = findSelectionState(doc);
  return state && { active: state.active, toggle: () => state.setActive(!state.active) };
}

/**
 * La page est le premier composant à états au-dessus de son « tirer pour rafraîchir » (props `onRefresh`).
 * Son état « sélection » est le booléen qui précède immédiatement l'ensemble des exemplaires cochés (`Set`) :
 * seul couple de ce genre parmi ses états (code du site, 29/09/2026). Rien si ce n'est pas sans ambiguïté.
 */
export function selectionStateAmong(ancestors: readonly Fiber[]): SelectionState | undefined {
  const states = statesAboveRefresh(ancestors) ?? [];
  const pairs = states.flatMap((mode, i) => {
    const selected = states[i + 1];
    return typeof mode.value === 'boolean' && selected && isSet(selected.value) ? [{ mode, selected }] : [];
  });
  const [pair, ...others] = pairs;
  if (!pair || others.length > 0) return undefined;
  return {
    active: pair.mode.value === true,
    setActive: (active) => {
      pair.mode.set(active);
      pair.selected.set(new Set());
    },
  };
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
  readonly tag: HTMLButtonElement | undefined;
  readonly untag: HTMLButtonElement | undefined;
  readonly discard: HTMLButtonElement | undefined;
  /** Message d'erreur sous la rangée (défausse refusée). */
  readonly error: HTMLElement | undefined;
}

export function findSelectionBar(doc: Document = document): SelectionBar | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>('body > div.fixed.bottom-4.card-frame')) {
    // Nos interfaces peuvent s'y ajouter (`.wm-root`) : la rangée du site est son premier enfant à lui.
    const row = [...root.children].find((child) => !isOwn(child));
    if (!(row instanceof HTMLElement) || !/sélectionnée|Actualisation/.test(textOf(row.firstElementChild))) continue;
    const buttons = [...row.querySelectorAll<HTMLButtonElement>('button')];
    const selectPage = buttons.find((button) => hasIcon(button, 'square-check-big', 'square'));
    const [tag, untag] = buttons.filter((button) => hasIcon(button, 'tag'));
    const number = row.firstElementChild?.querySelector('span.font-semibold');
    const count = number ? Number.parseInt(textOf(number), 10) : Number.NaN;
    return {
      root,
      row,
      count: Number.isInteger(count) ? count : undefined,
      selectPage,
      pageSelected: !!selectPage && hasIcon(selectPage, 'square') && !hasIcon(selectPage, 'square-check-big'),
      tag,
      untag,
      discard: buttons.find((button) => hasIcon(button, 'trash-2', 'trash2')),
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

/**
 * Calque de sélection de la case d'une face de la grille (hors sélection : aucun). En sélection, chaque case
 * (`div.relative.isolate.group`) reçoit après sa face un `div.pointer-events-none.absolute.inset-0.z-10`
 * (`transition-all duration-300`) : anneau d'accent si cochée, `bg-black/50` si la carte est en échange (pas
 * sélectionnable), sinon transparent ; et une case à cocher dans le coin (`z-30`). Le clic de la carte est
 * sur sa face (`div` à classe `glow-…`, `onClick`).
 */
export function selectionMarkOf(face: HTMLElement): SelectionMark | undefined {
  const overlay = face.closest('div.relative.isolate.group')?.querySelector<HTMLElement>(':scope > div.pointer-events-none.absolute.inset-0');
  return overlay ? { overlay, selected: overlay.classList.contains('ring-4') } : undefined;
}

/** Étiquette proposée dans la modale d'étiquetage groupé. */
export interface BulkTagOption {
  readonly button: HTMLButtonElement;
  /** Id de l'étiquette (clé React du bouton). */
  readonly id: string;
  readonly name: string;
  /** Style en ligne de sa pastille (couleurs de l'étiquette). */
  readonly chipStyle: string;
}

export interface BulkTagModal {
  readonly overlay: HTMLElement;
  readonly frame: HTMLElement;
  /** `add` : « Appliquer une étiquette » ; `remove` : « Retirer une étiquette ». */
  readonly mode: 'add' | 'remove';
  readonly close: HTMLButtonElement | undefined;
  /** Exemplaires sélectionnés (`user_cards.id`), lus dans les props de la modale. */
  readonly cardIds: readonly string[];
  /** Absent une fois l'étiquette appliquée (écran « n cartes étiquetées » + « Terminé »). */
  readonly form:
    | {
        /** Bloc du champ et de la liste (`div.space-y-3`). */
        readonly body: HTMLElement;
        readonly input: HTMLInputElement;
        readonly list: HTMLElement;
        readonly options: readonly BulkTagOption[];
        /** « Créer » + pastille du nom tapé, et sa couleur (quand le nom n'existe pas encore). */
        readonly create: { readonly row: HTMLElement; readonly button: HTMLButtonElement; readonly color: HTMLInputElement } | undefined;
      }
    | undefined;
}

/**
 * Modale « Appliquer une étiquette » / « Retirer une étiquette » de la sélection (portail
 * `div.fixed.inset-0.z-[60]`, cadre `card-frame … max-w-md`, croix ronde) : champ « Chercher ou créer une
 * étiquette… », liste des étiquettes (un bouton chacune ; en retrait, seulement celles des cartes
 * sélectionnées, avec leur nombre), ligne « Créer » + sélecteur de couleur quand le nom tapé n'existe pas.
 * Un clic sur une étiquette l'applique (`upsert`) ou la retire aussitôt, affiche « n cartes étiquetées » +
 * « Terminé », et la page s'actualise en entier (message au-dessus de la grille).
 */
export function findBulkTagModal(doc: Document = document): BulkTagModal | undefined {
  for (const overlay of doc.querySelectorAll<HTMLElement>(`body > ${SITE_OVERLAY}`)) {
    const frame = overlay.firstElementChild;
    if (!(frame instanceof HTMLElement)) continue;
    const title = textOf(frame.querySelector('h2'));
    const mode = title === 'Appliquer une étiquette' ? 'add' : title === 'Retirer une étiquette' ? 'remove' : undefined;
    if (!mode) continue;
    return { overlay, frame, mode, close: frame.querySelector<HTMLButtonElement>(':scope > button[aria-label="Fermer"]') ?? undefined, cardIds: readCardIds(frame), form: readForm(frame) };
  }
  return undefined;
}

function readCardIds(frame: HTMLElement): string[] {
  const cards = findPropsAbove(frame, (props) => typeof props.mode === 'string' && Array.isArray(props.cards))?.props.cards;
  return Array.isArray(cards) ? cards.flatMap((card: unknown) => (isRecord(card) && typeof card.id === 'string' ? [card.id] : [])) : [];
}

function readForm(frame: HTMLElement): BulkTagModal['form'] {
  const input = frame.querySelector<HTMLInputElement>('input[type="text"]');
  const body = input?.parentElement;
  const list = input?.nextElementSibling;
  if (!input || !body || !(list instanceof HTMLElement)) return undefined;
  const options: BulkTagOption[] = [];
  for (const button of list.querySelectorAll<HTMLButtonElement>(':scope > button')) {
    const id = fiberOf(button)?.key;
    const chip = button.querySelector('span');
    if (typeof id === 'string' && chip) options.push({ button, id, name: textOf(chip), chipStyle: chip.getAttribute('style') ?? '' });
  }
  const color = list.querySelector<HTMLInputElement>(':scope > div input[type="color"]');
  const row = color?.closest<HTMLElement>('div');
  const button = row?.querySelector<HTMLButtonElement>(':scope > button');
  return { body, input, list, options, create: color && row && button ? { row, button, color } : undefined };
}

/** Défausse de la sélection (`{ card_ids }` ; réponse `{ discarded_count, failed }`, `{ error }` si refusée). */
export function isBulkDiscard(request: NetRequest): boolean {
  return request.method === 'POST' && request.url.pathname === '/api/user-cards/bulk-discard';
}

/** Exemplaires d'une défausse de la sélection (`card_ids` du corps). */
export function readBulkDiscard(request: NetRequest): string[] {
  if (!isBulkDiscard(request)) return [];
  const body = parseJson(request.body ?? '');
  const ids = isRecord(body) && Array.isArray(body.card_ids) ? body.card_ids : [];
  return ids.filter((id): id is string => typeof id === 'string');
}

/**
 * Exemplaires que la défausse de la sélection n'a pas pu défausser (`failed` de la réponse ; sa forme n'est
 * pas connue, le site n'en lit que le nombre : identifiants, ou objets `id` / `card_id` / `user_card_id`).
 */
export function readBulkDiscardFailures(raw: unknown): string[] {
  const failed = isRecord(raw) && Array.isArray(raw.failed) ? raw.failed : [];
  return failed.flatMap((item: unknown) => {
    if (typeof item === 'string') return [item];
    if (!isRecord(item)) return [];
    const id = item.user_card_id ?? item.card_id ?? item.id;
    return typeof id === 'string' ? [id] : [];
  });
}

export interface BulkDiscardConfirm {
  readonly root: HTMLElement;
  readonly cancelButton: HTMLButtonElement;
  readonly confirmButton: HTMLButtonElement;
  /** Message d'erreur de la défausse (« Erreur lors de la défausse », « Erreur réseau »…). */
  readonly error: string | undefined;
}

/**
 * Confirmation de « Défausser (+n) » (portail `div.fixed.inset-0.z-[90]`, cadre `card-frame max-w-sm`) :
 * « Défausser n cartes ? », raretés, avertissement pour les L / UR / SR, titres, gain, « Annuler » ·
 * « Défausser » (rouge, « … » pendant l'envoi : `POST /api/user-cards/bulk-discard { card_ids }`, un
 * exemplaire de chaque carte). Réussie : fermée, message au-dessus de la grille, sélection vidée, solde et
 * page actualisés ; refusée : reste ouverte avec l'erreur. Le fond la ferme, sauf pendant l'envoi.
 */
export function findBulkDiscardConfirm(doc: Document = document): BulkDiscardConfirm | undefined {
  for (const root of doc.querySelectorAll<HTMLElement>(`body > ${SITE_OVERLAY}`)) {
    if (!/^Défausser \d+ cartes? \?$/.test(textOf(root.querySelector('h3')))) continue;
    const buttons = [...root.querySelectorAll<HTMLButtonElement>('button')];
    const cancelButton = buttons.find((button) => textOf(button) === 'Annuler');
    const confirmButton = buttons.find((button) => button !== cancelButton && button.classList.contains('bg-red-500'));
    if (!cancelButton || !confirmButton) continue;
    const error = textOf(root.querySelector('p.text-red-500')) || undefined;
    return { root, cancelButton, confirmButton, error };
  }
  return undefined;
}
