import type { DataItem, ImportCounts } from '@/core/data';
import { normalizeSearchText } from '@/site/search-text';

/** Éléments par page d'une longue liste. */
export const PAGE_SIZE = 50;

const DAY = 86_400_000;

/** « 812 o », « 4,2 Ko », « 3,1 Mo ». */
export function formatBytes(bytes: number): string {
  if (bytes < 1000) return `${bytes} o`;
  const [value, unit] = bytes < 1_000_000 ? [bytes / 1000, 'Ko'] : [bytes / 1_000_000, 'Mo'];
  return `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} ${unit}`;
}

export type ItemSort = 'date' | 'title' | 'count' | 'bytes';

/** Tris d'une longue liste, chacun dans son sens habituel ; « Nombre » seulement si les éléments en ont un. */
export function sortOptions(items: readonly DataItem[]): { readonly value: ItemSort; readonly label: string }[] {
  return [
    { value: 'date', label: 'Date' },
    { value: 'title', label: 'Nom' },
    ...(items.some((item) => item.count !== undefined) ? [{ value: 'count' as const, label: 'Nombre' }] : []),
    { value: 'bytes', label: 'Taille' },
  ];
}

const byTitle = (a: DataItem, b: DataItem) => a.title.localeCompare(b.title, 'fr', { sensitivity: 'base' });

const COMPARE: Readonly<Record<ItemSort, (a: DataItem, b: DataItem) => number>> = {
  // Les plus récents d'abord, sans date en fin.
  date: (a, b) => (b.date ?? -Infinity) - (a.date ?? -Infinity) || byTitle(a, b),
  title: byTitle,
  count: (a, b) => (b.count ?? 0) - (a.count ?? 0) || byTitle(a, b),
  bytes: (a, b) => b.bytes - a.bytes || byTitle(a, b),
};

/** Filtres des ventes d'une longue liste (`DataSet.salesFilters`) ; bornes comprises, `undefined` : sans borne. */
export interface SalesFilters {
  /** Codes de rareté : la carte en a au moins une vente. */
  readonly rarities: readonly string[];
  /** Prix médian d'une des raretés cochées (de n'importe laquelle si aucune). */
  readonly priceMin: number | undefined;
  readonly priceMax: number | undefined;
  /** Nombre de ventes, toutes raretés. */
  readonly countMin: number | undefined;
  readonly countMax: number | undefined;
  /** Chargée au-delà de la durée du cache (`stale`), ou il y a plus de ce nombre de jours ; 0 : peu importe. */
  readonly loadedDays: number | 'stale';
  /** Dernière vente il y a plus de ce nombre de jours (carte sans vente comprise) ; 0 : peu importe. */
  readonly idleDays: number;
}

export const NO_FILTERS: SalesFilters = {
  rarities: [],
  priceMin: undefined,
  priceMax: undefined,
  countMin: undefined,
  countMax: undefined,
  loadedDays: 0,
  idleDays: 0,
};

export function sameFilters(a: SalesFilters, b: SalesFilters): boolean {
  return (
    a.rarities.length === b.rarities.length &&
    a.rarities.every((rarity) => b.rarities.includes(rarity)) &&
    a.priceMin === b.priceMin &&
    a.priceMax === b.priceMax &&
    a.countMin === b.countMin &&
    a.countMax === b.countMax &&
    a.loadedDays === b.loadedDays &&
    a.idleDays === b.idleDays
  );
}

const within = (value: number, min: number | undefined, max: number | undefined) =>
  (min === undefined || value >= min) && (max === undefined || value <= max);

export function matchesFilters(item: DataItem, filters: SalesFilters, now = Date.now()): boolean {
  const loaded = filters.loadedDays;
  if (loaded === 'stale' && !item.stale) return false;
  if (typeof loaded === 'number' && loaded > 0 && (item.date === undefined || item.date >= now - loaded * DAY)) return false;
  if (!within(item.count ?? 0, filters.countMin, filters.countMax)) return false;
  if (filters.idleDays > 0 && item.lastSale !== undefined && item.lastSale >= now - filters.idleDays * DAY) return false;
  if (filters.rarities.length === 0 && filters.priceMin === undefined && filters.priceMax === undefined) return true;
  return Object.entries(item.medians ?? {}).some(
    ([rarity, price]) => (filters.rarities.length === 0 || filters.rarities.includes(rarity)) && within(price, filters.priceMin, filters.priceMax),
  );
}

/** Éléments dont le titre contient la recherche (sans accents ni casse) et qui passent les filtres, dans l'ordre du tri. */
export function selectItems(items: readonly DataItem[], search: string, sort: ItemSort, filters = NO_FILTERS, now = Date.now()): DataItem[] {
  const needle = normalizeSearchText(search);
  const found = items.filter(
    (item) => (needle === '' || normalizeSearchText(item.title).includes(needle)) && (filters === NO_FILTERS || matchesFilters(item, filters, now)),
  );
  return found.sort(COMPARE[sort]);
}

/** Total d'une liste : éléments, taille, date du plus récent. */
export function totalOf(items: readonly DataItem[]): { readonly count: number; readonly bytes: number; readonly latest: number | undefined } {
  let bytes = 0;
  let latest: number | undefined;
  for (const item of items) {
    bytes += item.bytes;
    if (item.date !== undefined && (latest === undefined || item.date > latest)) latest = item.date;
  }
  return { count: items.length, bytes, latest };
}

const count = (value: number, one: string, many: string) => `${value.toLocaleString('fr-FR')} ${value > 1 ? many : one}`;

export const itemsLabel = (value: number): string => count(value, 'élément', 'éléments');

/** « 340 éléments », ou « 12 éléments sur 340 » quand la recherche ou les filtres en cachent. */
export const resultsLabel = (shown: number, total: number): string => (shown === total ? itemsLabel(total) : `${itemsLabel(shown)} sur ${total.toLocaleString('fr-FR')}`);

/** « 312 ajouts · 24 mises à jour · 1 200 identiques » (parties nulles omises ; rien : « Rien à importer »). */
export function importSummary(counts: ImportCounts): string {
  const parts = [
    ...(counts.added > 0 ? [count(counts.added, 'ajout', 'ajouts')] : []),
    ...(counts.updated > 0 ? [count(counts.updated, 'mise à jour', 'mises à jour')] : []),
    ...(counts.unchanged > 0 ? [count(counts.unchanged, 'identique', 'identiques')] : []),
    ...(counts.invalid > 0 ? [count(counts.invalid, 'illisible', 'illisibles')] : []),
  ];
  return parts.length > 0 ? parts.join(' · ') : 'Rien à importer';
}

/** Somme de plusieurs imports. */
export function addCounts(all: readonly ImportCounts[]): ImportCounts {
  return all.reduce(
    (sum, counts) => ({
      added: sum.added + counts.added,
      updated: sum.updated + counts.updated,
      unchanged: sum.unchanged + counts.unchanged,
      invalid: sum.invalid + counts.invalid,
    }),
    { added: 0, updated: 0, unchanged: 0, invalid: 0 },
  );
}
