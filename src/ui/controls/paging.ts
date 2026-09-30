export type PageButton = 'first' | 'previous' | 'next' | 'last';

/** Ce qui change de page : un des quatre boutons ou le champ du numéro. */
export type PaginationControl = PageButton | 'input';

/**
 * Page où mène chaque bouton (à partir de 1), rien s'il n'y en a pas. Nombre de pages inconnu : pas de
 * dernière page, et une suivante tant que `hasNext` ne dit pas le contraire.
 */
export function pageTargets(page: number, total: number | undefined, hasNext = true): Record<PageButton, number | undefined> {
  const next = total === undefined ? hasNext : page < total;
  return {
    first: page > 1 ? 1 : undefined,
    previous: page > 1 ? page - 1 : undefined,
    next: next ? page + 1 : undefined,
    last: total !== undefined && page < total ? total : undefined,
  };
}

/** Numéro saisi, entier et borné aux pages qui existent ; rien si ce n'est pas un nombre. */
export function parsePage(draft: string, total: number | undefined): number | undefined {
  const value = Number(draft.trim().replace(',', '.'));
  if (draft.trim() === '' || !Number.isFinite(value)) return undefined;
  return Math.max(1, Math.min(total ?? Number.MAX_SAFE_INTEGER, Math.trunc(value)));
}
