import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { textOf } from '@/core/text';
import { isOwn } from '@/site/dom';
import { appendRarities, checkedRarities, readBaseListQuery, type BaseListQuery, type ListSource } from '@/site/list-query';
import { refreshAbove } from '@/site/list-page';
import { findRarityPills, type RarityPills } from '@/site/rarity-pills';

/*
 * Onglet « Parcourir » du marché (code du site, 30/09/2026) : `GET /api/marketplace?page=&limit=50&sort=[&mine=1][&q=][&rarity=…]`
 * (`page` à partir de 1, `mine=1` tant qu'il n'a pas reçu ses listes personnelles). Un changement de tri, de
 * raretés ou de recherche recharge la page 1, sans roue : la grille change à la réponse. « Charger la suite »
 * ajoute la page suivante. Pour relire ses seules listes personnelles, il demande `page=1&limit=1&mine=1`
 * (aussi au retour d'une annonce, filtres et annonces remis de `sessionStorage['marketplace_list_v3']`). La
 * page s'actualise par le rappel `onRefresh` de son composant « tirer pour rafraîchir » (aussi son
 * « Rafraîchir » quand la liste est vide).
 */

/** `page` à partir de 1. */
export type MarketplaceQuery = BaseListQuery;

const isMarketplace = (request: NetRequest) => request.method === 'GET' && request.url.pathname === '/api/marketplace';

/** Liste des annonces (pas la relecture des seules listes personnelles). */
export function isMarketplaceList(request: NetRequest): boolean {
  return isMarketplace(request) && request.url.searchParams.get('limit') !== '1';
}

/** Relecture des seules listes personnelles (`limit=1&mine=1`). */
export function isMarketplaceMineRefresh(request: NetRequest): boolean {
  return isMarketplace(request) && request.url.searchParams.get('limit') === '1';
}

export function readMarketplaceQuery(url: URL): MarketplaceQuery {
  return readBaseListQuery(url.searchParams);
}

export function sameMarketplaceChoice(a: MarketplaceQuery, b: MarketplaceQuery): boolean {
  return a.sort === b.sort && a.rarities === b.rarities;
}

/** Adresse de la liste avec les filtres de `query`, page, taille et `mine` gardés. Paramètres dans l'ordre du site. */
export function withMarketplaceFilters(url: URL, query: MarketplaceQuery): URL {
  const params = new URLSearchParams({ page: url.searchParams.get('page') ?? '1', limit: url.searchParams.get('limit') ?? '50' });
  params.set('sort', query.sort);
  if (url.searchParams.has('mine')) params.set('mine', url.searchParams.get('mine') ?? '1');
  if (query.search) params.set('q', query.search);
  appendRarities(params, query.rarities);
  const next = new URL(url.href);
  next.search = params.toString();
  return next;
}

/**
 * Filtres de l'onglet « Parcourir » (code du 30/09/2026), dans `div.space-y-3` : ligne `div.flex.flex-col.sm:flex-row.gap-2`
 * (champ `type="search"` dans `div.relative.flex-1`, loupe lucide à gauche, croix « Effacer la recherche » ;
 * « Rechercher », désactivé tant que le champ sans ses espaces vaut la recherche en cours ; `<select>` du tri :
 * Récemment listées, Mise la plus basse, Mise la plus haute, Fin imminente), puis la rangée des pastilles de
 * rareté (« Réinitialiser » dès qu'une est cochée). La recherche ne part qu'à Entrée ou « Rechercher ».
 */
export interface MarketplaceFilters {
  readonly area: HTMLElement;
  readonly line: HTMLElement;
  /** Cadre du champ (`div.relative`), dans la ligne. */
  readonly fieldBox: HTMLElement;
  readonly field: HTMLInputElement;
  readonly submit: HTMLButtonElement;
  readonly sort: HTMLSelectElement;
  readonly pills: RarityPills;
}

export function findMarketplaceFilters(doc: Document = document): MarketplaceFilters | undefined {
  const sort = [...(doc.querySelector('main')?.querySelectorAll('select') ?? [])].find((select) =>
    [...select.options].some((option) => option.value === 'ending_soon'),
  );
  const line = sort?.parentElement;
  const fieldBox = line?.firstElementChild;
  const area = line?.parentElement;
  if (!sort || !line || !(fieldBox instanceof HTMLElement) || !area) return undefined;
  const field = fieldBox.querySelector<HTMLInputElement>('input[type="search"]');
  const submit = [...line.children].find((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
  const pills = findRarityPills(area);
  if (!field || !submit || !pills) return undefined;
  return { area, line, fieldBox, field, submit, sort, pills };
}

/** « Charger la suite » (« Chargement… » pendant sa requête), sous la grille de « Parcourir ». */
export function findMarketplaceLoadMore(doc: Document = document): HTMLButtonElement | undefined {
  return [...(doc.querySelector('main')?.querySelectorAll<HTMLButtonElement>('button') ?? [])].find(
    (button) => /^(Charger la suite|Chargement…)$/.test(textOf(button)) && !isOwn(button),
  );
}

/**
 * Actualisation de la page (le rappel `onRefresh`, lu dans l'arbre React affiché) : liste de la page 1 avec les
 * filtres tels qu'ils sont, et listes personnelles. Elle part aussitôt.
 */
export function findMarketplaceRefresh(doc: Document = document): (() => unknown) | undefined {
  const line = findMarketplaceFilters(doc)?.line;
  return line && refreshAbove(line);
}

/** État de la page gardé dans l'onglet quand on ouvre une annonce, remis (puis effacé) par le site au retour. */
const KEPT_LIST = 'marketplace_list_v3';

/**
 * Filtres de la liste que le site va remettre sans la redemander (au retour d'une annonce) : la recherche
 * lancée, pas le texte du champ. À lire avant que la page ne s'affiche (le site efface l'entrée en la lisant).
 */
export function readMarketplaceKeptQuery(): MarketplaceQuery | undefined {
  let text: string | null;
  try {
    text = sessionStorage.getItem(KEPT_LIST);
  } catch {
    return undefined;
  }
  const raw = text === null ? undefined : parseJson(text);
  if (!isRecord(raw)) return undefined;
  const { submittedSearch, sort, rarityFilter } = raw;
  if (typeof submittedSearch !== 'string' || typeof sort !== 'string' || !Array.isArray(rarityFilter)) return undefined;
  if (!rarityFilter.every((rarity): rarity is string => typeof rarity === 'string')) return undefined;
  return { sort, search: submittedSearch, rarities: [...rarityFilter].sort().join(','), page: 1 };
}

/** « Charger la suite » : page ajoutée à la liste affichée. */
export const isMarketplaceAppend = (query: MarketplaceQuery) => (query.page ?? 1) > 1;

/** Choix affichés par les contrôles de la page (tri, raretés), sans recherche ni page. */
export function readMarketplaceChoice(filters: MarketplaceFilters): MarketplaceQuery {
  return { sort: filters.sort.value, search: '', rarities: checkedRarities(filters.pills), page: undefined };
}

/** Liste de l'onglet (recherche retenue, délai, mémoire des filtres). */
export const marketplaceList: ListSource<MarketplaceQuery> = {
  id: 'marketplace',
  isList: isMarketplaceList,
  readQuery: readMarketplaceQuery,
  sameChoice: sameMarketplaceChoice,
  appends: isMarketplaceAppend,
  field: () => findMarketplaceFilters()?.field,
  // Au retour d'une annonce, la liste gardée par le site s'affiche sans requête.
  kept: readMarketplaceKeptQuery,
};
