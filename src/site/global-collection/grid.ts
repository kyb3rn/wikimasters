import { CARD_CELL, FACE, findCardGrids } from '@/site/cards';
import { SITE_OVERLAY } from '@/site/modals';

/** Carte de la grille : sa case (`CARD_CELL`, enfant de la rangée) et sa face. */
export interface GlobalCollectionCard {
  readonly cell: HTMLElement;
  readonly face: HTMLElement;
}

/**
 * Cartes de la grille du catalogue, dans l'ordre de la liste (capture du 10/10/2026 : rangée `flex-wrap` > case >
 * face, comme la Collection) ; hors modales du site et hors nos interfaces. Absente pendant un chargement (roue à sa
 * place).
 */
export function findGlobalCollectionCards(doc: Document = document): GlobalCollectionCard[] | undefined {
  const main = doc.querySelector('main');
  if (!main) return undefined;
  for (const row of findCardGrids(main)) {
    if (row.closest(SITE_OVERLAY)) continue;
    const cards = [...row.children].flatMap((cell) => {
      if (!(cell instanceof HTMLElement) || !cell.matches(CARD_CELL)) return [];
      const face = cell.querySelector<HTMLElement>(`:scope > ${FACE}`);
      return face ? [{ cell, face }] : [];
    });
    if (cards.length > 0) return cards;
  }
  return undefined;
}
