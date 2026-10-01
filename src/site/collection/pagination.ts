import { currentFiberAncestors, type Fiber } from '@/core/react';
import { statesAboveRefresh } from '@/site/list-page';
import { findPaginationBars, type SitePaginationBar } from '@/site/pagination';

/**
 * Pagination de la page Collection (code du site, 29/09/2026) : une barre au-dessus et une au-dessous de
 * la grille, dans `div.scroll-mt-4.space-y-3`, seulement quand les compteurs donnent plus d'une page
 * (50 exemplaires par page). Pendant un chargement : roue et « Chargement… » à la place du numéro, boutons
 * désactivés. Changer de page, c'est changer son état React `page` (à partir de 0), puis faire défiler jusqu'en
 * haut de ce cadre ; la liste part aussitôt, sans ses compteurs (demandés en page 0 seulement). Le site n'a pas
 * de saut direct à une page.
 */

export function findCollectionPaginationBars(doc: Document = document): SitePaginationBar[] {
  return findPaginationBars(doc.querySelector('main'));
}

export function isPageLoading(bar: SitePaginationBar): boolean {
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
 * Parmi les états de la page (`statesAboveRefresh`), son état `page` est reconnu à sa valeur, la page affichée :
 * son seul autre état numérique est le nombre d'exemplaires, plus grand dès qu'il y a deux pages.
 */
export function pageSetterAmong(ancestors: readonly Fiber[], index: number): ((index: number) => void) | undefined {
  const [page, ...others] = (statesAboveRefresh(ancestors) ?? []).filter((state) => state.value === index);
  return page && others.length === 0 ? (next) => page.set(next) : undefined;
}
