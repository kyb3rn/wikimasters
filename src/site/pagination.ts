import { textOf } from '@/core/text';
import { isOwn } from '@/site/dom';

/**
 * Barre de pagination des listes du site (Collection, Toutes les cartes, collection d'un ami ; code du 29 et
 * 30/09/2026) : « ← Précédent », son libellé, « Suivant → ». Libellé : « Page x / y » ; pendant une recherche de
 * Toutes les cartes, sans total : « Page x · suite disponible » ou « Page x » ; pendant un chargement de la
 * Collection : roue et « Chargement… ».
 */
export interface SitePaginationBar {
  readonly bar: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly label: HTMLElement;
  readonly next: HTMLButtonElement;
}

const PREVIOUS = /^←\s*Précédent$/;
const NEXT = /^Suivant\s*→$/;

/** Barres de `scope` (`<main>` par défaut), hors nos interfaces. */
export function findPaginationBars(scope: ParentNode | null | undefined = document.querySelector('main')): SitePaginationBar[] {
  const bars: SitePaginationBar[] = [];
  for (const previous of scope?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
    if (!PREVIOUS.test(textOf(previous)) || isOwn(previous)) continue;
    const bar = previous.parentElement;
    const label = previous.nextElementSibling;
    const next = label?.nextElementSibling;
    if (!bar || !(label instanceof HTMLElement) || !(next instanceof HTMLButtonElement) || !NEXT.test(textOf(next))) continue;
    bars.push({ bar, previous, label, next });
  }
  return bars;
}

/** Boutons « ← Précédent » et « Suivant → » des barres. */
export function paginationButtons(bars: readonly SitePaginationBar[]): HTMLButtonElement[] {
  return bars.flatMap(({ previous, next }) => [previous, next]);
}

export interface PageLabel {
  /** À partir de 1. */
  readonly page: number;
  /** Nombre de pages, s'il est affiché. */
  readonly total?: number;
  /** Sans total : y a-t-il une page suivante. */
  readonly hasNext?: boolean;
}

/** « Page x / y », « Page x · suite disponible », « Page x » ; rien pendant un chargement. */
export function parsePageLabel(text: string): PageLabel | undefined {
  const match = /^Page\s+(\d+)(?:\s*\/\s*(\d+)|(\s*·\s*suite disponible))?$/.exec(text.trim());
  if (!match) return undefined;
  const page = Number(match[1]);
  return match[2] !== undefined ? { page, total: Number(match[2]) } : { page, hasNext: match[3] !== undefined };
}
