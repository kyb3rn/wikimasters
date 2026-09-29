import { injectStyle, ROOT_CLASS, setClass, watchDom } from '@/core/dom';
import { createLogger } from '@/core/log';
import { PULLS_GRID_CLASSES } from '@/services/pulls-grid';
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

const PAGINATION_LOCKED = 'wm-pagination-locked';
const CAROUSEL_LOCKED = 'wm-carousel-locked';

/** Événements qui changent de carte ou ouvrent la carte. */
const LOCKED_EVENTS = ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend'];

/* Dans la rangée du carrousel (écart gap-4 du site, 16 px), nos boutons et la flèche « suivante » sont
   resserrés à 8 px ; l'écart autour des pastilles ne change pas.
   Verrou : navigation atténuée, curseur « interdit » partout dans le carrousel sauf sur nos boutons. Les
   clics et glissements sont bloqués en capture. */
const CSS = `
.${CAROUSEL_ACTION}:not(.${PULLS_GRID_CLASSES.actions} *) { margin-right: -8px; }
.${PAGINATION_LOCKED} > button, .${PAGINATION_LOCKED} > div { opacity: 0.35; transition: opacity 0.15s; }
.${CAROUSEL_LOCKED} :is(button, [class*="glow-"]):not(.${CAROUSEL_ACTION}),
.${CAROUSEL_LOCKED} [class*="glow-"] * { cursor: not-allowed !important; }
`;

const log = createLogger('carrousel');
const listeners = new Set<() => void>();
let lock: CarouselLock | undefined;
/** Suivi de la page tant que le verrou est posé (le carrousel peut être redessiné). */
let marking: AbortController | undefined;
/** Clic de programme en cours, qui traverse le verrou. */
let passing = false;
let guarded = false;

function notify(): void {
  for (const listener of [...listeners]) {
    try {
      listener();
    } catch (error) {
      log.error('abonné en échec', error);
    }
  }
}

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

function mark(): void {
  // Un passage de watchDom déjà commencé peut encore nous appeler juste après la levée du verrou.
  if (!lock) return;
  const carousel = findCarousel();
  if (!carousel) return;
  setClass(carousel.nav, PAGINATION_LOCKED, true);
  setClass(carousel.root, CAROUSEL_LOCKED, true);
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
  mark();
  watchDom(mark, { signal: marking.signal });
  notify();
  return true;
}

/** Lève le verrou de `owner` (sans effet s'il ne le tient pas). */
export function unlockCarousel(owner: string): void {
  if (lock?.owner !== owner) return;
  lock = undefined;
  marking?.abort();
  marking = undefined;
  document
    .querySelectorAll(`.${PAGINATION_LOCKED}, .${CAROUSEL_LOCKED}`)
    .forEach((element) => element.classList.remove(PAGINATION_LOCKED, CAROUSEL_LOCKED));
  notify();
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
  if (options.signal.aborted) return;
  listeners.add(listener);
  options.signal.addEventListener('abort', () => listeners.delete(listener), { once: true });
}
