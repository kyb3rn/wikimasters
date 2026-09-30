import { isRecord } from '@/core/guards';
import { currentFiberAncestors, stateHooks, type Fiber } from '@/core/react';

/**
 * Pagination de la page Collection (code du site, 29/09/2026) : une barre au-dessus et une au-dessous de
 * la grille, dans `div.scroll-mt-4.space-y-3`, seulement quand les compteurs donnent plus d'une page
 * (50 exemplaires par page) : « ← Précédent », « Page x / y », « Suivant → ». Pendant un chargement :
 * roue et « Chargement… » à la place du numéro, boutons désactivés. Changer de page, c'est changer son
 * état React `page` (à partir de 0), puis faire défiler jusqu'en haut de ce cadre ; la liste part aussitôt,
 * sans ses compteurs (demandés en page 0 seulement). Le site n'a pas de saut direct à une page.
 */

export interface CollectionPaginationBar {
  readonly bar: HTMLElement;
  readonly previous: HTMLButtonElement;
  /** « Page x / y », ou la roue et « Chargement… ». */
  readonly label: HTMLElement;
  readonly next: HTMLButtonElement;
}

const PREVIOUS = /^←\s*Précédent$/;
const NEXT = /^Suivant\s*→$/;

const text = (element: Element) => element.textContent?.trim() ?? '';

export function findCollectionPaginationBars(doc: Document = document): CollectionPaginationBar[] {
  const bars: CollectionPaginationBar[] = [];
  for (const previous of doc.querySelector('main')?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
    if (!PREVIOUS.test(text(previous))) continue;
    const bar = previous.parentElement;
    const label = previous.nextElementSibling;
    const next = label?.nextElementSibling;
    if (!bar || !(label instanceof HTMLElement) || !(next instanceof HTMLButtonElement) || !NEXT.test(text(next))) continue;
    bars.push({ bar, previous, label, next });
  }
  return bars;
}

/** Boutons « ← Précédent » / « Suivant → » des deux barres. */
export function findCollectionPagination(doc: Document = document): HTMLButtonElement[] {
  return findCollectionPaginationBars(doc).flatMap(({ previous, next }) => [previous, next]);
}

export interface CollectionPage {
  /** À partir de 1. */
  readonly page: number;
  readonly total: number;
}

/** « Page x / y » ; rien pendant un chargement. */
export function readPageLabel(label: string): CollectionPage | undefined {
  const match = /^Page\s+(\d+)\s*\/\s*(\d+)$/.exec(label.trim());
  if (!match) return undefined;
  return { page: Number(match[1]), total: Number(match[2]) };
}

export function isPageLoading(bar: CollectionPaginationBar): boolean {
  return bar.label.querySelector('.animate-spin') !== null;
}

/**
 * De quoi changer de page (index à partir de 0), d'après la barre affichée et sa page (`index`, à partir
 * de 0). Rien si l'état n'est pas reconnu sans ambiguïté.
 */
export function findCollectionPageSetter(bar: HTMLElement, index: number): ((index: number) => void) | undefined {
  return pageSetterAmong(currentFiberAncestors(bar), index);
}

/**
 * La page Collection est le premier composant à états au-dessus de son « tirer pour rafraîchir » (props
 * `onRefresh`), qui entoure la pagination. Son état `page` est reconnu à sa valeur, la page affichée :
 * son seul autre état numérique est le nombre d'exemplaires, plus grand dès qu'il y a deux pages.
 */
export function pageSetterAmong(ancestors: readonly Fiber[], index: number): ((index: number) => void) | undefined {
  const refresh = ancestors.findIndex((fiber) => isRecord(fiber.memoizedProps) && typeof fiber.memoizedProps.onRefresh === 'function');
  if (refresh < 0) return undefined;
  for (const fiber of ancestors.slice(refresh + 1)) {
    const states = stateHooks(fiber);
    if (states.length === 0) continue;
    const [page, ...others] = states.filter((state) => state.value === index);
    return page && others.length === 0 ? (next) => page.set(next) : undefined;
  }
  return undefined;
}
