import { isRecord, isSet } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { currentFiberAncestors, fiberOf, stateHooks, type Fiber, type StateHook } from '@/core/react';
import { FACE } from '@/site/cards';
import { findListbox } from '@/site/listbox';
import { renewSet, uniqueStateRun } from '@/site/list-page';
import { checkedRarities, readBaseListQuery, SITE_TYPING_DELAY, type BaseListQuery, type ListSource } from '@/site/list-query';
import { findPaginationBars, type SitePaginationBar } from '@/site/pagination';
import { findRarityPills, type RarityPills } from '@/site/rarity-pills';

/**
 * Onglet « Collection » du profil d'un ami (code du site, 30/09/2026 ; absent des autres profils) :
 * `GET /api/profile/<pseudo>/collection?page=&sort=&stats=&q=&rarity=…&tag_id=&pending=1`, 50 exemplaires par
 * page (`page` à partir de 0 ; total et étiquettes lus en page 0 seulement, `stats=1`). La recherche part
 * 300 ms après la frappe ; tri, étiquette, raretés rechargent aussitôt, en page 0. Aucune requête n'est
 * interrompue et toute réponse est affichée, même périmée ; une erreur vide la grille. Pendant un chargement,
 * une roue au-dessus de la grille ; si la grille est vide, une roue **à la place de tout l'onglet** (filtres
 * compris). Revenir sur l'onglet recrée la page, aux filtres par défaut.
 * La fenêtre d'échange (côté « Cartes de … ») lit la même route, du même ami : seul le profil affiché est la page.
 */
export interface ProfileCollectionQuery extends BaseListQuery {
  /** Id de l'étiquette choisie, vide pour toutes. */
  readonly tag: string;
}

const LIST_PATH = /^\/api\/profile\/([^/]+)\/collection$/;
const PROFILE_PATH = /^\/profile\/([^/]+)\/?$/;

function decoded(segment: string | undefined): string | undefined {
  try {
    return segment === undefined ? undefined : decodeURIComponent(segment);
  } catch {
    return undefined;
  }
}

/** Collection du joueur dont le profil est affiché (`page` : adresse de la page). */
export function isProfileCollectionList(request: NetRequest, page: string = typeof location === 'undefined' ? '' : location.pathname): boolean {
  if (request.method !== 'GET') return false;
  const player = decoded(LIST_PATH.exec(request.url.pathname)?.[1]);
  return player !== undefined && player === decoded(PROFILE_PATH.exec(page)?.[1]);
}

export function readProfileCollectionQuery(url: URL): ProfileCollectionQuery {
  return { ...readBaseListQuery(url.searchParams), tag: url.searchParams.get('tag_id') ?? '' };
}

/** Mêmes choix : tri, étiquette, raretés. */
export function sameProfileCollectionChoice(a: ProfileCollectionQuery, b: ProfileCollectionQuery): boolean {
  return a.sort === b.sort && a.tag === b.tag && a.rarities === b.rarities;
}

/**
 * Filtres de l'onglet, dans `div.space-y-3` : ligne `div.flex.flex-col.gap-3.md:flex-row` (champ « Rechercher
 * par titre ou catégorie... », puis la rangée des listes : « Filtrer par étiquette » si l'ami en a, « Trier la
 * collection ») ; pastilles de rareté dessous ; texte ambre sous 3 caractères. L'onglet (`div.space-y-4`) a
 * ensuite « n cartes dans la collection de … », la roue d'un chargement, la grille, la pagination.
 */
export interface ProfileCollectionFilters {
  /** Contenu de l'onglet. */
  readonly root: HTMLElement;
  readonly area: HTMLElement;
  readonly line: HTMLElement;
  readonly field: HTMLInputElement;
  /** Rangée des listes. */
  readonly lists: HTMLElement;
  readonly tag: HTMLButtonElement | undefined;
  readonly sort: HTMLButtonElement;
  readonly pills: RarityPills;
}

export function findProfileCollectionFilters(doc: Document = document): ProfileCollectionFilters | undefined {
  const sort = doc.querySelector('main')?.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"][aria-label="Trier la collection"]');
  const lists = sort?.parentElement?.parentElement;
  const line = lists?.parentElement;
  const area = line?.parentElement;
  const root = area?.parentElement;
  if (!lists || !line || !area || !root) return undefined;
  const field = [...line.children].find((child): child is HTMLInputElement => child instanceof HTMLInputElement && child.type === 'text');
  const pills = findRarityPills(area);
  if (!field || !pills) return undefined;
  const tag = lists.querySelector<HTMLButtonElement>('button[aria-haspopup="listbox"][aria-label="Filtrer par étiquette"]') ?? undefined;
  return { root, area, line, field, lists, tag, sort, pills };
}

/** Liste de l'onglet (recherche retenue, délai, pagination). */
export const profileCollectionList: ListSource<ProfileCollectionQuery> = {
  id: 'profile-collection',
  isList: (request) => isProfileCollectionList(request),
  readQuery: readProfileCollectionQuery,
  sameChoice: sameProfileCollectionChoice,
  field: () => findProfileCollectionFilters()?.field,
  typingDelay: SITE_TYPING_DELAY,
};

/** Roue d'un chargement, au-dessus de la grille (enfant de l'onglet). */
export const PROFILE_COLLECTION_SPINNER = 'div.flex.justify-center.py-4:has(> .animate-spin)';

export function isProfileCollectionLoading(filters: ProfileCollectionFilters): boolean {
  return filters.root.querySelector(`:scope > ${PROFILE_COLLECTION_SPINNER}`) !== null;
}

/** Des cartes sont affichées (sinon : « Aucune carte avec ces filtres. », « Collection vide. »). */
export function hasProfileCollectionCards(filters: ProfileCollectionFilters): boolean {
  return filters.root.querySelector(':scope > div.flex-wrap.justify-center') !== null;
}

/** Choix affichés par les contrôles de l'onglet (tri, étiquette, raretés), sans recherche ni page. */
export function readProfileCollectionChoice(filters: ProfileCollectionFilters): ProfileCollectionQuery | undefined {
  const sort = findListbox(filters.sort);
  const tag = filters.tag && findListbox(filters.tag);
  if (!sort || (filters.tag && !tag)) return undefined;
  return { sort: sort.value, tag: tag?.value ?? '', search: '', rarities: checkedRarities(filters.pills), page: undefined };
}

/**
 * États de l'onglet (code du 30/09/2026), dans l'ordre : exemplaires, total, étiquettes, cartes en échange,
 * chargement, champ, recherche en cours, **tri, raretés (`Set`), étiquette (`null` ou id), page** (à partir de
 * 0), exemplaire ouvert, erreur. Sa liste se charge dans un effet qui dépend de la page, du tri, de la
 * recherche en cours, des raretés et de l'étiquette : un nouvel ensemble de raretés (mêmes raretés) la
 * recharge telle quelle.
 */
export interface ProfileCollectionStates {
  readonly rarities: StateHook;
  readonly page: StateHook;
}

/**
 * L'onglet est le premier composant à états au-dessus de la ligne des filtres : tri (reconnu à sa valeur, celle
 * de la liste), raretés, étiquette, page. Rien si c'est ambigu.
 */
export function profileCollectionStatesAmong(ancestors: readonly Fiber[], sort: string): ProfileCollectionStates | undefined {
  const tests = [(value: unknown) => value === sort, isSet, (value: unknown) => value === null || typeof value === 'string', (value: unknown) => typeof value === 'number'];
  const [, rarities, , page] = uniqueStateRun(ancestors, tests) ?? [];
  return rarities && page ? { rarities, page } : undefined;
}

export function findProfileCollectionStates(doc: Document = document): ProfileCollectionStates | undefined {
  const filters = findProfileCollectionFilters(doc);
  const sort = filters && findListbox(filters.sort);
  return filters && sort ? profileCollectionStatesAmong(currentFiberAncestors(filters.line), sort.value) : undefined;
}

/** De quoi recharger la liste telle qu'elle est (filtres, page), par l'effet de l'onglet ; rien si son état est illisible. */
export function findProfileCollectionReload(doc: Document = document): (() => void) | undefined {
  const states = findProfileCollectionStates(doc);
  return states && (() => renewSet(states.rarities));
}

export interface ProfileCollectionFace {
  readonly face: HTMLElement;
  /** Je possède aussi la carte (`owned_by_viewer` de l'exemplaire ; le site ne l'affiche pas). */
  readonly owned: boolean;
}

/**
 * Cartes de la grille (`div.flex-wrap.justify-center > div.relative`, clé React = id de l'exemplaire, › face), lues
 * dans l'état de l'onglet (ses exemplaires, tels que l'API les donne).
 */
export function findProfileCollectionFaces(doc: Document = document): ProfileCollectionFace[] {
  const filters = findProfileCollectionFilters(doc);
  const grid = filters?.root.querySelector(':scope > div.flex-wrap.justify-center');
  const copies = grid && filters && viewedCopies(filters);
  if (!grid || !copies) return [];
  const owned = new Map(copies.map((copy) => [copy.id, copy.owned_by_viewer]));
  return [...grid.children].flatMap((cell) => {
    const face = cell.querySelector<HTMLElement>(`:scope > ${FACE}`);
    const key = fiberOf(cell)?.key;
    const isOwned = typeof key === 'string' ? owned.get(key) : undefined;
    return face && isOwned !== undefined ? [{ face, owned: isOwned }] : [];
  });
}

/** Cartes de l'onglet que je possède aussi (ids de cartes) : pour la modale d'un de ses exemplaires. */
export function readProfileOwnedCards(doc: Document = document): ReadonlySet<string> | undefined {
  const filters = findProfileCollectionFilters(doc);
  const copies = filters && viewedCopies(filters);
  return copies && new Set(copies.flatMap((copy) => (copy.owned_by_viewer && typeof copy.card_id === 'string' ? [copy.card_id] : [])));
}

interface ViewedCopy {
  readonly id: string;
  readonly card_id?: unknown;
  readonly owned_by_viewer: boolean;
}

const isViewedCopy = (value: unknown): value is ViewedCopy =>
  isRecord(value) && typeof value.id === 'string' && typeof value.owned_by_viewer === 'boolean';

/** Exemplaires de l'onglet (premier composant à états au-dessus des filtres), tels que l'API les donne. */
function viewedCopies(filters: ProfileCollectionFilters): ViewedCopy[] | undefined {
  const states = currentFiberAncestors(filters.line)
    .map((fiber) => stateHooks(fiber))
    .find((list) => list.length > 0);
  const copies = states?.find(({ value }) => Array.isArray(value) && value.length > 0 && value.every(isViewedCopy))?.value;
  return Array.isArray(copies) ? copies.filter(isViewedCopy) : undefined;
}

/** Barre de pagination sous la grille. */
export function findProfileCollectionPaginationBars(doc: Document = document): SitePaginationBar[] {
  const root = findProfileCollectionFilters(doc)?.root;
  return root ? findPaginationBars(root) : [];
}
