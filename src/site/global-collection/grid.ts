import { FACE, findCardGrids } from '@/site/cards';
import { SITE_OVERLAY } from '@/site/modals';

/** Grille du catalogue (captures du 29/09/2026) : rangée `flex-wrap` dont chaque enfant est une face, sans case autour. */
export interface GlobalCollectionGrid {
  readonly row: HTMLElement;
  /** Faces, dans l'ordre de la liste. */
  readonly faces: HTMLElement[];
}

/** Grille de la page, hors modales du site et hors nos interfaces ; absente pendant un chargement (roue à sa place). */
export function findGlobalCollectionGrid(doc: Document = document): GlobalCollectionGrid | undefined {
  const main = doc.querySelector('main');
  if (!main) return undefined;
  for (const row of findCardGrids(main)) {
    if (row.closest(SITE_OVERLAY)) continue;
    const faces = [...row.children].filter((child): child is HTMLElement => child instanceof HTMLElement && child.matches(FACE));
    if (faces.length > 0) return { row, faces };
  }
  return undefined;
}
