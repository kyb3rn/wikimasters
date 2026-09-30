import { currentFiberAncestors, stateHooks, type Fiber, type StateHook } from '@/core/react';
import { findListbox } from '@/site/listbox';
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

const isSet = (value: unknown) => Object.prototype.toString.call(value) === '[object Set]';

/**
 * La page est le premier composant à états au-dessus de la ligne des filtres. Tri, raretés et page s'y suivent :
 * le tri est reconnu à sa valeur (celle de la liste affichée), suivi d'un `Set` et d'un nombre. Rien si ce
 * n'est pas sans ambiguïté.
 */
export function globalCollectionStatesAmong(ancestors: readonly Fiber[], sort: string): GlobalCollectionStates | undefined {
  for (const fiber of ancestors) {
    const states = stateHooks(fiber);
    if (states.length === 0) continue;
    const found = states.flatMap((state, i) => {
      const rarities = states[i + 1];
      const page = states[i + 2];
      return state.value === sort && rarities && isSet(rarities.value) && page && typeof page.value === 'number' ? [{ rarities, page }] : [];
    });
    const [only, ...others] = found;
    return only && others.length === 0 ? only : undefined;
  }
  return undefined;
}

export function findGlobalCollectionStates(doc: Document = document): GlobalCollectionStates | undefined {
  const filters = findGlobalCollectionFilters(doc);
  const sort = filters && findListbox(filters.sort);
  return filters && sort ? globalCollectionStatesAmong(currentFiberAncestors(filters.line), sort.value) : undefined;
}

/** Recharge la liste telle qu'elle est (filtres, page), par l'effet de la page. Faux si son état est illisible. */
export function reloadGlobalCollection(doc: Document = document): boolean {
  const states = findGlobalCollectionStates(doc);
  if (!states) return false;
  states.rarities.set(new Set(states.rarities.value as Set<unknown>));
  return true;
}
