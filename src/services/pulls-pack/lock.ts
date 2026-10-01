import { classMarks, injectStyle, ROOT_CLASS, watchDom } from '@/core/dom';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { PULLS_GRID_CLASSES } from '@/services/pulls-grid';
import { FACE } from '@/site/cards';
import { findCarousel } from '@/site/pulls';

/** Action en cours sur la carte affichée par le carrousel. */
export interface CarouselLock {
  /** Qui la mène (id de la fonctionnalité) : seul lui peut lever le verrou. */
  readonly owner: string;
  /** Ce qui se passe, pour l'info-bulle des boutons des autres (« Défausse en cours… »). */
  readonly label: string;
}

/**
 * Nos boutons d'action (rangée du carrousel, dessous des cartes de la grille) : hors du verrou, ils montrent
 * leur propre état.
 */
export const CAROUSEL_ACTION = 'wm-carousel-action';
/** Conteneur d'un bouton posé en tête de nos actions d'une carte (`PackActionPlace`). */
export const ACTION_START = 'wm-pack-action-start';

const PAGINATION_LOCKED = 'wm-pagination-locked';
const CAROUSEL_LOCKED = 'wm-carousel-locked';

/** Événements qui changent de carte ou ouvrent la carte. */
const LOCKED_EVENTS = ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'];

/* Dans la rangée du carrousel (écart gap-4 du site, 16 px), nos boutons et la flèche « suivante » sont
   resserrés à 8 px ; l'écart autour des pastilles ne change pas. Sous une carte de la grille, les boutons posés en
   tête passent devant les autres.
   Verrou : navigation atténuée, curseur « interdit » partout dans le carrousel sauf sur nos boutons. Les
   clics et glissements sont bloqués en capture. */
const CSS = `
.${CAROUSEL_ACTION}:not(.${PULLS_GRID_CLASSES.actions} *) { margin-right: -8px; }
.${PULLS_GRID_CLASSES.actions} > .${ACTION_START} > * { order: -1; }
.${PAGINATION_LOCKED} > button, .${PAGINATION_LOCKED} > div { opacity: 0.35; transition: opacity 0.15s; }
.${CAROUSEL_LOCKED} :is(button, ${FACE}):not(.${CAROUSEL_ACTION}),
.${CAROUSEL_LOCKED} ${FACE} * { cursor: not-allowed !important; }
`;

const changes = createListeners(createLogger('carrousel'));
let lock: CarouselLock | undefined;
/** Suivi de la page tant que le verrou est posé (le carrousel peut être redessiné). */
let marking: AbortController | undefined;
/** Clic de programme en cours, qui traverse le verrou. */
let passing = false;
let guarded = false;

function block(event: Event): void {
  if (!lock || passing || !(event.target instanceof Element)) return;
  if (event.target.closest(`.${ROOT_CLASS}`)) return;
  if (!findCarousel()?.root.contains(event.target)) return;
  event.preventDefault();
  event.stopImmediatePropagation();
}

/** Styles de nos boutons d'action et du verrou : à poser au montage d'une fonctionnalité qui en pose. */
export function injectCarouselStyle(): void {
  injectStyle('pulls-carousel', CSS);
}

function ensureGuard(): void {
  if (guarded) return;
  guarded = true;
  injectCarouselStyle();
  for (const type of LOCKED_EVENTS) window.addEventListener(type, block, { capture: true, passive: false });
}

export function carouselLock(): CarouselLock | undefined {
  return lock;
}

/**
 * Réserve la carte affichée pour une action (défausse, ouverture de la mise aux enchères) : clics et
 * glissements de l'utilisateur bloqués dans le carrousel, hors de nos boutons. Une action à la fois :
 * faux si une autre tient déjà le carrousel.
 */
export function lockCarousel(owner: string, label: string): boolean {
  if (lock) return lock.owner === owner;
  ensureGuard();
  lock = { owner, label };
  marking = new AbortController();
  // Classes retirées à la levée du verrou, des seuls éléments marqués.
  const marks = classMarks(marking.signal);
  const mark = () => {
    const carousel = findCarousel();
    if (!carousel) return;
    marks.set(carousel.nav, PAGINATION_LOCKED, true);
    marks.set(carousel.root, CAROUSEL_LOCKED, true);
  };
  mark();
  watchDom(mark, { signal: marking.signal });
  changes.emit();
  return true;
}

/** Lève le verrou de `owner` (sans effet s'il ne le tient pas). */
export function unlockCarousel(owner: string): void {
  if (lock?.owner !== owner) return;
  lock = undefined;
  marking?.abort();
  marking = undefined;
  changes.emit();
}

/** Clic de programme sur un élément du carrousel (flèche, carte), qui traverse le verrou. */
export function clickThrough(element: HTMLElement): void {
  passing = true;
  try {
    element.click();
  } finally {
    passing = false;
  }
}

export function onCarouselLockChange(listener: () => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}
