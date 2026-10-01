import { ROOT_CLASS } from '@/core/dom';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { textOf } from '@/core/text';

/** Classes de la grille, mises en forme par la fonctionnalité qui l'affiche. */
export const PULLS_GRID_CLASSES = {
  grid: 'wm-pulls-grid',
  slot: 'wm-pulls-slot',
  card: 'wm-pulls-card',
  actions: 'wm-pulls-actions',
} as const;

/**
 * Grille « toutes les cartes d'un coup » de /pulls : une case par carte, dans l'ordre du paquet (celui
 * des pastilles du carrousel). La copie de la face arrive dans sa case quand la carte est prête ; sous la
 * carte, une zone reçoit les boutons d'autres fonctionnalités (défaussage rapide).
 */
export interface PullsGrid {
  readonly element: HTMLElement;
  readonly slots: readonly PullsGridSlot[];
}

export interface PullsGridSlot {
  /** Position dans le paquet. */
  readonly index: number;
  readonly element: HTMLElement;
  /** Copie de la face de la carte, absente tant qu'elle n'a pas été prise. */
  readonly face: HTMLElement | undefined;
  readonly title: string | undefined;
  /** Carte arrivée (visible). */
  readonly arrived: boolean;
  /** Sous la carte : les boutons des autres fonctionnalités. */
  readonly actions: HTMLElement;
}

const changes = createListeners(createLogger('grille des paquets'));

function box(className: string): HTMLDivElement {
  const element = document.createElement('div');
  element.className = className;
  return element;
}

/** Grille vide de `count` cases, à nous (`.wm-root`) : l'observateur de DOM ignore ce qui s'y passe. */
export function createPullsGrid(count: number): HTMLElement {
  const grid = box(`${ROOT_CLASS} ${PULLS_GRID_CLASSES.grid}`);
  for (let index = 0; index < count; index++) {
    const slot = box(PULLS_GRID_CLASSES.slot);
    slot.dataset.index = String(index);
    slot.append(box(PULLS_GRID_CLASSES.card), box(PULLS_GRID_CLASSES.actions));
    grid.append(slot);
  }
  return grid;
}

function readSlot(element: HTMLElement, index: number): PullsGridSlot | undefined {
  const card = element.querySelector(`:scope > .${PULLS_GRID_CLASSES.card}`);
  const actions = element.querySelector<HTMLElement>(`:scope > .${PULLS_GRID_CLASSES.actions}`);
  if (!card || !actions) return undefined;
  const face = card.firstElementChild instanceof HTMLElement ? card.firstElementChild : undefined;
  return {
    index,
    element,
    face,
    title: face && textOf(face.querySelector('h3')),
    arrived: element.dataset.state === 'arrived',
    actions,
  };
}

export function findPullsGrid(scope: ParentNode = document): PullsGrid | undefined {
  const element = scope.querySelector<HTMLElement>(`.${PULLS_GRID_CLASSES.grid}`);
  return element ? readPullsGrid(element) : undefined;
}

/** État d'une grille créée par `createPullsGrid`, qu'elle soit dans la page ou pas encore. */
export function readPullsGrid(element: HTMLElement): PullsGrid | undefined {
  const slots: PullsGridSlot[] = [];
  for (const [index, slot] of element.querySelectorAll<HTMLElement>(`:scope > .${PULLS_GRID_CLASSES.slot}`).entries()) {
    const read = readSlot(slot, index);
    if (!read) return undefined;
    slots.push(read);
  }
  return { element, slots };
}

/** Pose (ou remplace) la copie de la face dans sa case. */
export function setSlotFace(slot: PullsGridSlot, face: HTMLElement): void {
  slot.element.querySelector(`:scope > .${PULLS_GRID_CLASSES.card}`)?.replaceChildren(face);
}

/** La carte apparaît (animation d'arrivée). */
export function markArrived(slot: PullsGridSlot): void {
  slot.element.dataset.state = 'arrived';
}

/** À appeler après tout changement de la grille (carte arrivée, copie remplacée, grille retirée). */
export function notifyPullsGridChange(): void {
  changes.emit();
}

/**
 * Prévient quand la grille change. Ce qui s'y passe échappe à `watchDom` (nos interfaces sont ignorées) :
 * une fonctionnalité qui y pose des boutons ou des tampons s'y abonne en plus.
 */
export function onPullsGridChange(listener: () => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}
