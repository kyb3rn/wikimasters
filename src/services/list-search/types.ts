import type { NetRequest } from '@/core/net';
import type { ListQuery, ListSource } from '@/site/list-query';

export type { ListQuery, ListSource } from '@/site/list-query';

/** Mêmes filtres, la page mise à part. */
export function sameFilters<Q extends ListQuery>(source: ListSource<Q>, a: Q, b: Q): boolean {
  return source.sameChoice(a, b) && a.search === b.search;
}

/** Requête de la liste ou de sa compagne (`ListSource.isCompanion`), venue de la page. */
export function isSourceRequest<Q extends ListQuery>(source: ListSource<Q>): (request: NetRequest) => boolean {
  return (request) => !request.own && (source.isList(request) || source.isCompanion?.(request) === true);
}

/**
 * - `search` : les choix affichés par les contrôles ne sont plus ceux de la liste affichée ;
 * - `reload` : liste affichée à jour (ou en échec), à recharger ;
 * - `loading` : liste demandée au site, pas encore reçue.
 */
export type SearchStatus = 'search' | 'reload' | 'loading';

/** Délai sans autre changement avant qu'un changement de filtre ne charge la liste (frappe comprise). */
export const SEARCH_DELAY = 700;
