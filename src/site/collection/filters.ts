import { appendRarities, readBaseListQuery, SITE_TYPING_DELAY, type BaseListQuery, type ListSource } from '@/site/list-query';
import { refreshAbove } from '@/site/list-page';
import { isCollectionList, isCollectionStats } from './collection';

/**
 * Filtres de la page Collection (code du site, 29/09/2026) : champ de recherche (pris en compte 300 ms
 * après la frappe), deux listes déroulantes à lui (bouton `aria-haspopup="listbox"` : étiquette, tri),
 * pastilles de rareté. Tout changement remet la page à 0 et relance aussitôt la liste, et ses compteurs
 * (la page 0 seulement), partis juste avant elle. La page s'actualise en entier (étiquettes, échanges, liste)
 * par le rappel `onRefresh` de son composant « tirer pour rafraîchir », qui l'entoure.
 */

/** Filtres d'une requête de la liste (`/api/my-collection`) ou de ses compteurs (`…/stats`, sans page). */
export interface CollectionQuery extends BaseListQuery {
  /** Étiquette choisie : son id, `untagged` (« Sans étiquette ») ou vide (toutes). */
  readonly tag: string;
}

export function readCollectionQuery(url: URL): CollectionQuery {
  const params = url.searchParams;
  return { ...readBaseListQuery(params), tag: params.get('untagged') === '1' ? 'untagged' : (params.get('tag_id') ?? '') };
}

/** Mêmes choix : les deux listes (étiquette, tri) et les raretés cochées. */
export function sameCollectionChoice(a: CollectionQuery, b: CollectionQuery): boolean {
  return a.sort === b.sort && a.tag === b.tag && a.rarities === b.rarities;
}

/** Valeur de « Sans étiquette » dans la liste des étiquettes du site. */
export const UNTAGGED_OPTION = '__untagged__';

/**
 * Adresse de la liste ou des compteurs (`url`) avec les filtres de `query`, sa page et `stats` gardés.
 * Paramètres dans l'ordre du site : tri, recherche, raretés, étiquette.
 */
export function withCollectionFilters(url: URL, query: CollectionQuery): URL {
  const params = new URLSearchParams({ sort: query.sort });
  if (query.search) params.set('q', query.search);
  appendRarities(params, query.rarities);
  if (query.tag === 'untagged') params.set('untagged', '1');
  else if (query.tag) params.set('tag_id', query.tag);
  for (const key of ['page', 'stats']) {
    const value = url.searchParams.get(key);
    if (value !== null) params.set(key, value);
  }
  const next = new URL(url.href);
  next.search = params.toString();
  return next;
}

export interface CollectionFilters {
  /** Rangée des deux listes. */
  readonly row: HTMLElement;
  readonly tag: HTMLButtonElement;
  readonly sort: HTMLButtonElement;
}

export function findCollectionFilters(doc: Document = document): CollectionFilters | undefined {
  const main = doc.querySelector('main');
  const tag = main?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"][aria-label="Filtrer par étiquette"]');
  const sort = main?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"][aria-label="Trier la collection"]');
  // Chaque liste est dans son propre cadre (`div.relative`), les deux cadres dans la rangée.
  const row = tag?.parentElement?.parentElement;
  if (!tag || !sort || !(row instanceof HTMLElement) || !row.contains(sort)) return undefined;
  return { row, tag, sort };
}

/** Champ de recherche de la page : le champ texte de la ligne des deux listes. */
export function findCollectionSearchField(doc: Document = document): HTMLInputElement | undefined {
  const line = findCollectionFilters(doc)?.row.parentElement;
  return [...(line?.children ?? [])].find((child): child is HTMLInputElement => child instanceof HTMLInputElement && child.type === 'text');
}

/** Actualisation de la page (filtres tels qu'ils sont, page gardée) : `refreshAbove`. */
export function findCollectionRefresh(doc: Document = document): (() => unknown) | undefined {
  const filters = findCollectionFilters(doc);
  return filters && refreshAbove(filters.row);
}

/** Liste de la page et ses compteurs (recherche retenue, délai, mémoire des filtres). */
export const collectionList: ListSource<CollectionQuery> = {
  id: 'collection',
  isList: isCollectionList,
  isCompanion: isCollectionStats,
  readQuery: readCollectionQuery,
  sameChoice: sameCollectionChoice,
  field: () => findCollectionSearchField(),
  typingDelay: SITE_TYPING_DELAY,
};
