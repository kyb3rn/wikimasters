import type { NetRequest } from '@/core/net';

/** Filtres d'une requête de liste du site : une recherche, une page, et des choix (tri, raretés…). */
export interface ListQuery {
  readonly search: string;
  readonly page: number | undefined;
}

/** Liste filtrée d'une page du site : ses requêtes et ce qu'elles disent. */
export interface ListSource<Q extends ListQuery> {
  isList(request: NetRequest): boolean;
  readQuery(url: URL): Q;
  /** Mêmes choix : tout sauf la recherche et la page. */
  sameChoice(a: Q, b: Q): boolean;
}

/** Mêmes filtres, la page mise à part. */
export function sameFilters<Q extends ListQuery>(source: ListSource<Q>, a: Q, b: Q): boolean {
  return source.sameChoice(a, b) && a.search === b.search;
}

/**
 * - `search` : les choix affichés par les contrôles ne sont plus ceux de la liste affichée ;
 * - `reload` : liste affichée à jour (ou en échec), à recharger ;
 * - `loading` : liste demandée au site, pas encore reçue.
 */
export type SearchStatus = 'search' | 'reload' | 'loading';

/** Délai sans autre changement avant qu'un changement de filtre ne charge la liste (frappe comprise). */
export const SEARCH_DELAY = 700;
