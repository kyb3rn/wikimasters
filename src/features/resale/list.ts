import { isRecord } from '@/core/guards';
import type { OwnedCopy } from '@/site/api';
import { parseRarity, RARITIES, type Rarity } from '@/site/rarity';
import { normalizeSearchText } from '@/site/search-text';

/** Ce que filtres, tri et total lisent d'une carte de la page : exemplaire de la collection ou vente en cours. */
export type ResaleCard = Pick<OwnedCopy, 'cardId' | 'title' | 'category' | 'rarity' | 'shiny' | 'obtainedAt'>;

/** Cartes par page (demande de l'utilisateur : pas de ralentissement avec des centaines de cartes). */
export const PAGE_SIZE = 50;

export type ResaleSort = 'price' | 'rarity' | 'name' | 'added';

export const SORT_OPTIONS: readonly { readonly value: ResaleSort; readonly label: string }[] = [
  { value: 'price', label: 'Prix' },
  { value: 'rarity', label: 'Rareté' },
  { value: 'name', label: 'Nom' },
  { value: 'added', label: "Date d'ajout" },
];

/** Sens du tri : croissant ou décroissant (demande de l'utilisateur). */
export type SortOrder = 'asc' | 'desc';

/** Sens de chaque tri quand on le choisit : le plus cher, la plus rare, A → Z, la plus récente d'abord. */
export const DEFAULT_ORDER: Readonly<Record<ResaleSort, SortOrder>> = { price: 'desc', rarity: 'desc', name: 'asc', added: 'desc' };

/** Ce que dit chaque sens de chaque tri (info-bulle du bouton du sens). */
export const ORDER_LABELS: Readonly<Record<ResaleSort, Readonly<Record<SortOrder, string>>>> = {
  price: { desc: 'Du plus cher au moins cher', asc: 'Du moins cher au plus cher' },
  rarity: { desc: 'De la plus rare à la plus commune', asc: 'De la plus commune à la plus rare' },
  name: { asc: 'De A à Z', desc: 'De Z à A' },
  added: { desc: 'De la plus récente à la plus ancienne', asc: 'De la plus ancienne à la plus récente' },
};

export interface ResaleFilters {
  /** Texte cherché dans le titre et la catégorie, sans accents ni casse. */
  readonly search: string;
  /** Raretés de l'exemplaire ; aucune : toutes. */
  readonly rarities: readonly Rarity[];
  readonly sort: ResaleSort;
  readonly order: SortOrder;
}

/** Tri par défaut : le prix, du plus haut au plus bas (demande de l'utilisateur). */
export const DEFAULT_FILTERS: ResaleFilters = { search: '', rarities: [], sort: 'price', order: 'desc' };

export function sameFilters(a: ResaleFilters, b: ResaleFilters): boolean {
  return (
    a.search.trim() === b.search.trim() && a.sort === b.sort && a.order === b.order && a.rarities.join() === b.rarities.join()
  );
}

/** Filtres retenus (`wm-resale-filters-v1`) ; illisibles : `undefined`. */
export function parseFilters(raw: unknown): ResaleFilters | undefined {
  if (!isRecord(raw) || typeof raw.search !== 'string' || !Array.isArray(raw.rarities)) return undefined;
  const sort = SORT_OPTIONS.find((option) => option.value === raw.sort)?.value;
  if (!sort) return undefined;
  const checked = new Set(raw.rarities.map(parseRarity));
  // Retenus avant le sens du tri : celui du tri.
  const order = raw.order === 'asc' || raw.order === 'desc' ? raw.order : DEFAULT_ORDER[sort];
  return { search: raw.search, rarities: RARITIES.filter((rarity) => checked.has(rarity)), sort, order };
}

function matches(copy: ResaleCard, needle: string, rarities: ReadonlySet<Rarity>): boolean {
  if (rarities.size > 0 && !rarities.has(copy.rarity)) return false;
  return needle === '' || normalizeSearchText(`${copy.title} ${copy.category}`).includes(needle);
}

const newestFirst = (a: ResaleCard, b: ResaleCard) => b.obtainedAt - a.obtainedAt;
// Créé au premier tri : un appel au niveau du module le garderait dans le fichier de production.
let collator: Intl.Collator | undefined;
const byName = (a: ResaleCard, b: ResaleCard) => (collator ??= new Intl.Collator('fr', { sensitivity: 'base', numeric: true })).compare(a.title, b.title);

/**
 * Prix d'un exemplaire pour le tri : son prix souhaité s'il en a un, sinon la moyenne des 7 dernières ventes dans sa
 * rareté ; ni l'un ni l'autre : `undefined`.
 */
export type PriceOf<T extends ResaleCard> = (copy: T) => number | undefined;

/**
 * Ordre d'un tri dans un sens. Ex aequo : la plus récente d'abord, dans les deux sens ; sans prix : en fin de liste
 * dans les deux sens (un prix inconnu n'est ni haut ni bas).
 */
function compare<T extends ResaleCard>(sort: ResaleSort, order: SortOrder, priceOf: PriceOf<T>): (a: T, b: T) => number {
  const sign = order === 'asc' ? 1 : -1;
  switch (sort) {
    case 'price':
      return (a, b) => {
        const [x, y] = [priceOf(a), priceOf(b)];
        if (x === undefined || y === undefined) return (x === undefined ? 1 : 0) - (y === undefined ? 1 : 0) || newestFirst(a, b);
        return sign * (x - y) || newestFirst(a, b);
      };
    case 'rarity':
      // `RARITIES` va de L à C : décroissant = la plus rare d'abord.
      return (a, b) => -sign * (RARITIES.indexOf(a.rarity) - RARITIES.indexOf(b.rarity)) || newestFirst(a, b);
    case 'name':
      return (a, b) => sign * byName(a, b) || newestFirst(a, b);
    case 'added':
      return (a, b) => sign * (a.obtainedAt - b.obtainedAt);
  }
}

/** Exemplaires retenus par les filtres, dans l'ordre du tri. */
export function selectCopies<T extends ResaleCard>(copies: readonly T[], filters: ResaleFilters, priceOf: PriceOf<T>): T[] {
  const needle = normalizeSearchText(filters.search);
  const rarities = new Set(filters.rarities);
  return copies.filter((copy) => matches(copy, needle, rarities)).sort(compare(filters.sort, filters.order, priceOf));
}

/**
 * Total des prix souhaités des exemplaires (chacun compté une fois : deux exemplaires de la même carte dans la même
 * rareté comptent deux fois), et le nombre de ceux qui n'en ont pas.
 */
export function wishedTotal<T extends ResaleCard>(copies: readonly T[], wishedOf: (copy: T) => number | undefined): { total: number; missing: number } {
  let total = 0;
  let missing = 0;
  for (const copy of copies) {
    const price = wishedOf(copy);
    if (price === undefined) missing++;
    else total += price;
  }
  return { total, missing };
}

/** Nombre de pages (au moins une). */
export const pageCount = (items: number): number => Math.max(1, Math.ceil(items / PAGE_SIZE));

/** Exemplaires de la page `page` (à partir de 1). */
export function pageOf<T>(items: readonly T[], page: number): T[] {
  return items.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
}
