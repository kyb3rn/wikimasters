import { ROOT_CLASS } from '@/core/dom';
import { isRecord } from '@/core/guards';
import { fiberAncestors, fiberOf } from '@/core/react';
import { parseCards, type PackCard } from './pack';

/**
 * Carrousel des cartes d'un paquet ouvert sur `/pulls` (relevé le 29/09/2026) :
 *
 *   div.flex.flex-col (racine)
 *     div.flex.items-center.gap-2        « Carte n / N »
 *     div.relative.inline-flex           zone de la carte : enveloppe animée (`animate-card-flip…`, recréée à
 *                                        chaque carte) > face `[class*="glow-"]` avec son `h3` ; tant que les
 *                                        images du paquet chargent, un cadre `animate-pulse` à la place
 *     div.flex.items-center.gap-4        ‹ rangée de navigation ›
 *       button.w-12.h-12.rounded-full    précédente (désactivée sur la première)
 *       div.flex.items-center.gap-2      une pastille par carte, l'active porte `scale-125`
 *       button.w-12.h-12.rounded-full    suivante (désactivée sur la dernière)
 *     button « Encore n cartes » (désactivé tant que toutes les cartes n'ont pas été vues) / « Continuer »
 *
 * Le site change aussi de carte par glissement (pointeur) sur la zone de la carte. Changer de carte joue
 * le son `card-flip` (et `legendary-reveal` sur une L) ; une L shiny s'affiche d'abord sans son habillage
 * shiny, révélé à la fin de l'animation de la carte (et retenu pour la suite).
 */
export interface Carousel {
  readonly root: HTMLElement;
  /** « Carte n / N ». */
  readonly counter: HTMLElement | undefined;
  /** Zone de la carte affichée. */
  readonly holder: HTMLElement | undefined;
  readonly nav: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly next: HTMLButtonElement;
  /** Boîte des pastilles, entre les deux flèches. */
  readonly dotsBox: HTMLElement;
  readonly dots: readonly HTMLButtonElement[];
  /** Bouton sous la navigation : « Encore n cartes » (désactivé) puis « Continuer ». */
  readonly proceed: HTMLButtonElement | undefined;
  /** Carte affichée (position dans le paquet), -1 si aucune pastille n'est active. */
  readonly index: number;
  /** Face de la carte affichée. */
  readonly face: HTMLElement | undefined;
  readonly title: string | undefined;
}

const ARROW = 'button.w-12.h-12.rounded-full';

/** Nos ajouts (`.wm-root`) sont ignorés : voisin du site le plus proche. */
function siteSibling(element: Element, direction: 'previous' | 'next'): Element | undefined {
  const step = (node: Element) => (direction === 'next' ? node.nextElementSibling : node.previousElementSibling);
  let current = step(element);
  while (current?.classList.contains(ROOT_CLASS)) current = step(current);
  return current ?? undefined;
}

export function findCarousel(doc: Document = document): Carousel | undefined {
  const scope = doc.querySelector('main') ?? doc;
  for (const nav of scope.querySelectorAll<HTMLElement>('div.flex.items-center.gap-4')) {
    const children = [...nav.children].filter((child) => !child.classList.contains(ROOT_CLASS));
    const [previous, dotsBox, next] = children;
    if (children.length !== 3 || !previous || !dotsBox || !next) continue;
    if (!previous.matches(ARROW) || !next.matches(ARROW) || !(dotsBox instanceof HTMLElement)) continue;
    const dots = [...dotsBox.querySelectorAll('button')];
    const root = nav.parentElement;
    if (dots.length === 0 || !root) continue;

    // Les copies de cartes posées par le script (`.wm-root`) ne sont pas la carte du carrousel.
    const face = [...root.querySelectorAll<HTMLElement>('[class*="glow-"]')].find(
      (el) => el.querySelector('h3') && !el.closest(`.${ROOT_CLASS}`),
    );
    const holder = siteSibling(nav, 'previous');
    const counter = holder && siteSibling(holder, 'previous');
    const after = siteSibling(nav, 'next');
    return {
      root,
      counter: counter instanceof HTMLElement ? counter : undefined,
      holder: holder instanceof HTMLElement ? holder : undefined,
      nav,
      previous: previous as HTMLButtonElement,
      next: next as HTMLButtonElement,
      dotsBox,
      dots,
      proceed: after instanceof HTMLButtonElement ? after : undefined,
      index: dots.findIndex((dot) => dot.classList.contains('scale-125')),
      face,
      title: face?.querySelector('h3')?.textContent?.trim(),
    };
  }
  return undefined;
}

/**
 * Cartes du paquet affiché, lues dans l'état React du carrousel (ses props `{ cards, ownedCopies, onDone }`) :
 * `is_shiny` y est vrai dès l'ouverture, avant que la face ne montre le shiny.
 */
export function carouselCards(carousel: Carousel): PackCard[] | undefined {
  for (const fiber of fiberAncestors(fiberOf(carousel.root), 20)) {
    const props = fiber.memoizedProps;
    if (isRecord(props) && Array.isArray(props.cards) && typeof props.onDone === 'function') return parseCards(props.cards);
  }
  return undefined;
}
