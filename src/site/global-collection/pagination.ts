/**
 * Pagination de « Toutes les cartes » (code du site, 30/09/2026) : une barre sous la grille
 * (`div.flex.items-center.justify-center.gap-2.py-4`), « ← Précédent », « Page x / y », « Suivant → ». Avec une
 * recherche (3 caractères au moins), pas de total : « Page x · suite disponible » ou « Page x ». Un clic change
 * l'état `page` de la page, puis fait défiler `<main>` tout en haut ; la liste part aussitôt.
 */
export interface GlobalCollectionPaginationBar {
  readonly bar: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly label: HTMLElement;
  readonly next: HTMLButtonElement;
}

const PREVIOUS = /^←\s*Précédent$/;
const NEXT = /^Suivant\s*→$/;
const text = (element: Element) => element.textContent?.trim() ?? '';

export function findGlobalCollectionPaginationBars(doc: Document = document): GlobalCollectionPaginationBar[] {
  const bars: GlobalCollectionPaginationBar[] = [];
  for (const previous of doc.querySelector('main')?.querySelectorAll<HTMLButtonElement>('button') ?? []) {
    if (!PREVIOUS.test(text(previous)) || previous.closest('.wm-root')) continue;
    const bar = previous.parentElement;
    const label = previous.nextElementSibling;
    const next = label?.nextElementSibling;
    if (!bar || !(label instanceof HTMLElement) || !(next instanceof HTMLButtonElement) || !NEXT.test(text(next))) continue;
    bars.push({ bar, previous, label, next });
  }
  return bars;
}

export interface GlobalCollectionPage {
  /** À partir de 1. */
  readonly page: number;
  /** Nombre de pages, sauf pendant une recherche. */
  readonly total?: number;
  /** Sans total : y a-t-il une page suivante. */
  readonly hasNext?: boolean;
}

export function readGlobalCollectionPageLabel(label: string): GlobalCollectionPage | undefined {
  const match = /^Page\s+(\d+)(?:\s*\/\s*(\d+)|(\s*·\s*suite disponible))?$/.exec(label.trim());
  if (!match) return undefined;
  const page = Number(match[1]);
  return match[2] !== undefined ? { page, total: Number(match[2]) } : { page, hasNext: match[3] !== undefined };
}
