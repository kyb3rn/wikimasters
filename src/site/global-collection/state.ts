import { isSet } from '@/core/guards';
import { currentFiberAncestors, type Fiber, type StateHook } from '@/core/react';
import { findListbox } from '@/site/listbox';
import { renewSet, uniqueStateRun } from '@/site/list-page';
import { findGlobalCollectionFilters } from './filters';

/**
 * États de la page « Toutes les cartes » (code du site, 30/09/2026), dans l'ordre : cartes, total, suite
 * disponible, compteurs, amis, possédées, liste de souhaits, offres en cours, filtre « Liste de souhaits »,
 * erreur, chargement, champ de recherche, **tri, raretés (`Set`), page** (à partir de 0), carte ouverte,
 * recherche en cours. Sa liste se charge dans un effet qui dépend de la page, de la recherche en cours, des
 * raretés, du tri et du filtre : un nouvel ensemble de raretés (mêmes raretés) la recharge telle quelle.
 */
export interface GlobalCollectionStates {
  readonly rarities: StateHook;
  readonly page: StateHook;
}

/**
 * La page est le premier composant à états au-dessus de la ligne des filtres : tri (reconnu à sa valeur, celle de
 * la liste affichée), raretés, page. Rien si ce n'est pas sans ambiguïté.
 */
export function globalCollectionStatesAmong(ancestors: readonly Fiber[], sort: string): GlobalCollectionStates | undefined {
  const [, rarities, page] = uniqueStateRun(ancestors, [(value) => value === sort, isSet, (value) => typeof value === 'number']) ?? [];
  return rarities && page ? { rarities, page } : undefined;
}

export function findGlobalCollectionStates(doc: Document = document): GlobalCollectionStates | undefined {
  const filters = findGlobalCollectionFilters(doc);
  const sort = filters && findListbox(filters.sort);
  return filters && sort ? globalCollectionStatesAmong(currentFiberAncestors(filters.line), sort.value) : undefined;
}

/** De quoi recharger la liste telle qu'elle est (filtres, page), par l'effet de la page ; rien si son état est illisible. */
export function findGlobalCollectionReload(doc: Document = document): (() => void) | undefined {
  const states = findGlobalCollectionStates(doc);
  return states && (() => renewSet(states.rarities));
}
