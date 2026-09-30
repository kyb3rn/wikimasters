import { sameListChoice, sameOtherFilters, SEARCH_TYPING_DELAY, type CollectionQuery } from '@/site/collection';

/** Un chargement dû à un changement de filtre part ce délai après le dernier changement. */
export const SEARCH_DELAY = 700;

/**
 * Attente avant d'envoyer une requête de la liste ou de ses compteurs : aucune si ses filtres sont ceux
 * de la requête précédente du même genre (autre page, actualisation, rechargement après une défausse) ;
 * sinon `SEARCH_DELAY`, dont le site a déjà attendu une part après une frappe dans le champ de recherche.
 */
export function searchWait(query: CollectionQuery, previous: CollectionQuery | undefined): number {
  if (!previous || (sameListChoice(query, previous) && sameOtherFilters(query, previous))) return 0;
  return query.search === previous.search ? SEARCH_DELAY : SEARCH_DELAY - SEARCH_TYPING_DELAY;
}
