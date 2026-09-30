import { isRecord } from '@/core/guards';
import { currentFiberAncestors } from '@/core/react';

/**
 * Filtres de la page Collection (code du site, 29/09/2026) : champ de recherche (pris en compte 300 ms
 * après la frappe), deux listes déroulantes à lui (bouton `aria-haspopup="listbox"` : étiquette, tri),
 * pastilles de rareté. Tout changement remet la page à 0 et relance aussitôt la liste, et ses compteurs
 * (la page 0 seulement). La page s'actualise en entier (étiquettes, échanges, liste) par le rappel
 * `onRefresh` de son composant « tirer pour rafraîchir », qui l'entoure.
 */

/** Attente du site après la dernière frappe dans le champ de recherche, avant de charger. */
export const SEARCH_TYPING_DELAY = 300;

/** Filtres d'une requête de la liste (`/api/my-collection`) ou de ses compteurs (`…/stats`). */
export interface CollectionQuery {
  readonly sort: string;
  /** Étiquette choisie : son id, `untagged` (« Sans étiquette ») ou vide (toutes). */
  readonly tag: string;
  readonly search: string;
  /** Raretés cochées, triées. */
  readonly rarities: string;
  /** Liste seulement : les compteurs n'ont pas de page. */
  readonly page: number | undefined;
}

export function readCollectionQuery(url: URL): CollectionQuery {
  const params = url.searchParams;
  const page = Number(params.get('page'));
  return {
    sort: params.get('sort') ?? '',
    tag: params.get('untagged') === '1' ? 'untagged' : (params.get('tag_id') ?? ''),
    search: params.get('q') ?? '',
    rarities: params.getAll('rarity').sort().join(','),
    page: params.has('page') && Number.isInteger(page) ? page : undefined,
  };
}

/** Mêmes choix : les deux listes (étiquette, tri) et les raretés cochées. */
export function sameListChoice(a: CollectionQuery, b: CollectionQuery): boolean {
  return a.sort === b.sort && a.tag === b.tag && a.rarities === b.rarities;
}

/** Même autre filtre : la recherche. */
export function sameOtherFilters(a: CollectionQuery, b: CollectionQuery): boolean {
  return a.search === b.search;
}

/** Mêmes filtres, la page mise à part. */
export function sameFilters(a: CollectionQuery, b: CollectionQuery): boolean {
  return sameListChoice(a, b) && sameOtherFilters(a, b);
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
  for (const rarity of query.rarities ? query.rarities.split(',') : []) params.append('rarity', rarity);
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

export function isCollectionSearchField(target: EventTarget | null, doc: Document = document): boolean {
  return target instanceof HTMLInputElement && target === findCollectionSearchField(doc);
}

/** Liste déroulante du site, lue dans les props de son composant (arbre React affiché). */
export interface CollectionSelect {
  readonly ariaLabel: string;
  readonly value: string;
  readonly options: readonly { readonly value: string; readonly label: string }[];
  /** Ce que fait le site au choix d'une option (`__manage_tags__` : ouvre « Gérer les étiquettes »). */
  onChange(value: string): void;
}

/** Composant de la liste dont `button` est le bouton : son `ariaLabel` est l'aria-label du bouton. */
export function findCollectionSelect(button: HTMLButtonElement): CollectionSelect | undefined {
  const ariaLabel = button.getAttribute('aria-label');
  if (!ariaLabel) return undefined;
  for (const fiber of currentFiberAncestors(button)) {
    const props = fiber.memoizedProps;
    if (!isRecord(props) || props.ariaLabel !== ariaLabel || typeof props.onChange !== 'function') continue;
    const onChange = props.onChange as (value: string) => void;
    const options = (Array.isArray(props.options) ? props.options : []).flatMap((option: unknown) =>
      isRecord(option) && typeof option.value === 'string'
        ? [{ value: option.value, label: typeof option.label === 'string' ? option.label : '' }]
        : [],
    );
    return { ariaLabel, value: typeof props.value === 'string' ? props.value : '', options, onChange: (value) => onChange(value) };
  }
  return undefined;
}

/**
 * Actualisation de la page (le rappel `onRefresh`, lu dans l'arbre React affiché : celui d'un rendu
 * précédent chargerait les anciens filtres). Elle part aussitôt : ses requêtes sont lancées pendant l'appel.
 */
export function findCollectionRefresh(doc: Document = document): (() => unknown) | undefined {
  const filters = findCollectionFilters(doc);
  if (!filters) return undefined;
  for (const fiber of currentFiberAncestors(filters.row)) {
    const props = fiber.memoizedProps;
    if (isRecord(props) && typeof props.onRefresh === 'function') {
      const refresh = props.onRefresh as () => unknown;
      return () => refresh();
    }
  }
  return undefined;
}
