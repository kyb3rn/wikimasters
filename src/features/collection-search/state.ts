import { sameListChoice, sameOtherFilters, type CollectionQuery } from '@/site/collection';

/**
 * Requête due à un changement d'étiquette, de tri ou de raretés : depuis la requête précédente du même
 * genre (liste ou compteurs), seuls ces choix ont changé. Une actualisation (mêmes choix), une autre page
 * ou une recherche ne le sont pas : elles chargent avec les choix tels qu'ils sont.
 */
export function isListChange(query: CollectionQuery, previous: CollectionQuery | undefined): boolean {
  return previous !== undefined && !sameListChoice(query, previous) && sameOtherFilters(query, previous);
}

/**
 * - `search` : les choix (listes, raretés) ne correspondent plus à la liste affichée ;
 * - `reload` : liste affichée à jour (ou en échec), à recharger ;
 * - `loading` : liste demandée au site, pas encore reçue.
 */
export type SearchStatus = 'search' | 'reload' | 'loading';

export function searchStatus(facts: {
  readonly loading: boolean;
  /** Filtres de la dernière liste demandée par la page. */
  readonly requested: CollectionQuery | undefined;
  /** Filtres de la liste affichée. */
  readonly shown: CollectionQuery | undefined;
}): SearchStatus {
  if (facts.loading) return 'loading';
  if (facts.requested && facts.shown && !sameListChoice(facts.requested, facts.shown)) return 'search';
  return 'reload';
}
