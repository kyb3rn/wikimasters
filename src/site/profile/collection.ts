import type { NetRequest } from '@/core/net';
import { currentFiberAncestors, stateHooks, type Fiber, type StateHook } from '@/core/react';
import { findListbox } from '@/site/listbox';
import { findRarityPills, type RarityPills } from '@/site/rarity-pills';

/**
 * Onglet « Collection » du profil d'un ami (code du site, 30/09/2026 ; absent des autres profils) :
 * `GET /api/profile/<pseudo>/collection?page=&sort=&stats=&q=&rarity=…&tag_id=&pending=1`, 50 exemplaires par
 * page (`page` à partir de 0 ; total et étiquettes lus en page 0 seulement, `stats=1`). La recherche part
 * 300 ms après la frappe ; tri, étiquette, raretés rechargent aussitôt, en page 0. Aucune requête n'est
 * interrompue et toute réponse est affichée, même périmée ; une erreur vide la grille. Pendant un chargement,
 * une roue au-dessus de la grille ; si la grille est vide, une roue **à la place de tout l'onglet** (filtres
 * compris). Revenir sur l'onglet recrée la page, aux filtres par défaut.
 */
export interface ProfileCollectionQuery {
  readonly sort: string;
  /** Id de l'étiquette choisie, vide pour toutes. */
  readonly tag: string;
  readonly search: string;
  /** Raretés cochées, triées. */
  readonly rarities: string;
  /** À partir de 0. */
  readonly page: number | undefined;
}

/** Attente du site après la dernière frappe dans le champ de recherche, avant de charger. */
export const PROFILE_COLLECTION_TYPING_DELAY = 300;

const LIST_PATH = /^\/api\/profile\/[^/]+\/collection$/;

export function isProfileCollectionList(request: NetRequest): boolean {
  return request.method === 'GET' && LIST_PATH.test(request.url.pathname);
}

export function readProfileCollectionQuery(url: URL): ProfileCollectionQuery {
  const params = url.searchParams;
  const page = Number(params.get('page'));
  return {
    sort: params.get('sort') ?? '',
    tag: params.get('tag_id') ?? '',
    search: params.get('q') ?? '',
    rarities: params.getAll('rarity').sort().join(','),
    page: params.has('page') && Number.isInteger(page) ? page : undefined,
  };
}

/** Mêmes choix : tri, étiquette, raretés. */
export function sameProfileCollectionChoice(a: ProfileCollectionQuery, b: ProfileCollectionQuery): boolean {
  return a.sort === b.sort && a.tag === b.tag && a.rarities === b.rarities;
}

export const profileCollectionList = {
  isList: isProfileCollectionList,
  readQuery: readProfileCollectionQuery,
  sameChoice: sameProfileCollectionChoice,
};

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
  return {
    sort: sort.value,
    tag: tag?.value ?? '',
    search: '',
    rarities: filters.pills.pills
      .filter((pill) => pill.checked)
      .map((pill) => pill.rarity)
      .sort()
      .join(','),
    page: undefined,
  };
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

const isSet = (value: unknown) => Object.prototype.toString.call(value) === '[object Set]';

/**
 * L'onglet est le premier composant à états au-dessus de la ligne des filtres. Le tri y est reconnu à sa
 * valeur (celle de la liste), suivi d'un `Set`, de l'étiquette et d'un nombre. Rien si c'est ambigu.
 */
export function profileCollectionStatesAmong(ancestors: readonly Fiber[], sort: string): ProfileCollectionStates | undefined {
  for (const fiber of ancestors) {
    const states = stateHooks(fiber);
    if (states.length === 0) continue;
    const found = states.flatMap((state, i) => {
      const rarities = states[i + 1];
      const tag = states[i + 2];
      const page = states[i + 3];
      const valid =
        state.value === sort &&
        rarities &&
        isSet(rarities.value) &&
        tag &&
        (tag.value === null || typeof tag.value === 'string') &&
        page &&
        typeof page.value === 'number';
      return valid ? [{ rarities, page }] : [];
    });
    const [only, ...others] = found;
    return only && others.length === 0 ? only : undefined;
  }
  return undefined;
}

export function findProfileCollectionStates(doc: Document = document): ProfileCollectionStates | undefined {
  const filters = findProfileCollectionFilters(doc);
  const sort = filters && findListbox(filters.sort);
  return filters && sort ? profileCollectionStatesAmong(currentFiberAncestors(filters.line), sort.value) : undefined;
}

/** Recharge la liste telle qu'elle est (filtres, page), par l'effet de l'onglet. Faux si son état est illisible. */
export function reloadProfileCollection(doc: Document = document): boolean {
  const states = findProfileCollectionStates(doc);
  if (!states) return false;
  states.rarities.set(new Set(states.rarities.value as Set<unknown>));
  return true;
}

/** Barre de pagination sous la grille : « ← Précédent », « Page x / y », « Suivant → ». */
export interface ProfileCollectionPaginationBar {
  readonly bar: HTMLElement;
  readonly previous: HTMLButtonElement;
  readonly label: HTMLElement;
  readonly next: HTMLButtonElement;
}

const PREVIOUS = /^←\s*Précédent$/;
const NEXT = /^Suivant\s*→$/;
const text = (element: Element) => element.textContent?.trim() ?? '';

export function findProfileCollectionPaginationBars(doc: Document = document): ProfileCollectionPaginationBar[] {
  const root = findProfileCollectionFilters(doc)?.root;
  const bars: ProfileCollectionPaginationBar[] = [];
  for (const previous of root?.querySelectorAll<HTMLButtonElement>(':scope > div > button') ?? []) {
    if (!PREVIOUS.test(text(previous))) continue;
    const bar = previous.parentElement;
    const label = previous.nextElementSibling;
    const next = label?.nextElementSibling;
    if (!bar || !(label instanceof HTMLElement) || !(next instanceof HTMLButtonElement) || !NEXT.test(text(next))) continue;
    bars.push({ bar, previous, label, next });
  }
  return bars;
}

export function readProfileCollectionPageLabel(label: string): { readonly page: number; readonly total: number } | undefined {
  const match = /^Page\s+(\d+)\s*\/\s*(\d+)$/.exec(label.trim());
  return match ? { page: Number(match[1]), total: Number(match[2]) } : undefined;
}
