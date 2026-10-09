import { normalizeTagName } from '@/site/collection';
import type { ListboxOption, SortOrder } from '@/ui/controls';

type Rgb = readonly [number, number, number];

/** Toutes les étiquettes, celles qui ont des cartes, celles qui n'en ont aucune. */
export type TagUse = 'all' | 'used' | 'empty';
export type TagSort = 'name' | 'count' | 'color';
export type ColorFamily = 'red' | 'orange' | 'yellow' | 'green' | 'cyan' | 'blue' | 'purple' | 'pink' | 'neutral';

export interface TagFilters {
  readonly query: string;
  readonly use: TagUse;
  readonly family: ColorFamily | 'all';
  readonly sort: TagSort;
  readonly order: SortOrder;
}

/** Ce que la fenêtre montre à son ouverture : tout, dans l'ordre du site (par nom). */
export const DEFAULT_FILTERS: TagFilters = { query: '', use: 'all', family: 'all', sort: 'name', order: 'asc' };

export const USE_OPTIONS: readonly { readonly value: TagUse; readonly label: string }[] = [
  { value: 'all', label: 'Toutes les étiquettes' },
  { value: 'used', label: 'Avec des cartes' },
  { value: 'empty', label: 'Sans carte' },
];

export const SORT_OPTIONS: readonly { readonly value: TagSort; readonly label: string }[] = [
  { value: 'name', label: 'Nom' },
  { value: 'count', label: 'Nombre de cartes' },
  { value: 'color', label: 'Couleur' },
];

/** Sens de chaque tri quand on le choisit : de A à Z, le plus de cartes d'abord, du rouge au rose. */
export const SORT_ORDER: Readonly<Record<TagSort, SortOrder>> = { name: 'asc', count: 'desc', color: 'asc' };

export const ORDER_LABELS: Readonly<Record<TagSort, Readonly<Record<SortOrder, string>>>> = {
  name: { asc: 'De A à Z', desc: 'De Z à A' },
  count: { asc: "Le moins de cartes d'abord", desc: "Le plus de cartes d'abord" },
  color: { asc: 'Du rouge au rose, puis du noir au blanc', desc: 'Du blanc au noir, puis du rose au rouge' },
};

/** Familles dans l'ordre du cercle des couleurs, neutres à la fin ; `sample` : teinte de leur pastille. */
export const COLOR_FAMILIES: readonly { readonly value: ColorFamily; readonly label: string; readonly sample: string }[] = [
  { value: 'red', label: 'Rouges', sample: '#ef4444' },
  { value: 'orange', label: 'Oranges', sample: '#fb923c' },
  { value: 'yellow', label: 'Jaunes', sample: '#facc15' },
  { value: 'green', label: 'Verts', sample: '#4ade80' },
  { value: 'cyan', label: 'Turquoises', sample: '#2dd4bf' },
  { value: 'blue', label: 'Bleus', sample: '#60a5fa' },
  { value: 'purple', label: 'Violets', sample: '#a78bfa' },
  { value: 'pink', label: 'Roses', sample: '#f472b6' },
  { value: 'neutral', label: 'Noirs, gris, blancs', sample: '#94a3b8' },
];

export function parseTagUse(value: string): TagUse {
  return USE_OPTIONS.find((option) => option.value === value)?.value ?? 'all';
}

export function parseFamily(value: string): ColorFamily | 'all' {
  return COLOR_FAMILIES.find((family) => family.value === value)?.value ?? 'all';
}

export function parseTagSort(value: string): TagSort | undefined {
  return SORT_OPTIONS.find((option) => option.value === value)?.value;
}

function hsl([r, g, b]: Rgb): { readonly h: number; readonly s: number; readonly l: number } {
  const [rn, gn, bn] = [r / 255, g / 255, b / 255];
  const max = Math.max(rn, gn, bn);
  const min = Math.min(rn, gn, bn);
  const l = (max + min) / 2;
  const d = max - min;
  if (d === 0) return { h: 0, s: 0, l };
  const s = d / (1 - Math.abs(2 * l - 1));
  const sector = max === rn ? ((gn - bn) / d + 6) % 6 : max === gn ? (bn - rn) / d + 2 : (rn - gn) / d + 4;
  return { h: sector * 60, s, l };
}

const isNeutral = ({ s, l }: { readonly s: number; readonly l: number }) => s < 0.15 || l < 0.1 || l > 0.95;

/**
 * Famille d'une couleur, par sa teinte. Les couleurs sont presque toutes choisies à la main (56 différentes pour 67
 * étiquettes, capture du 06/10/2026) : un filtre par couleur exacte ne regrouperait rien. Bornes réglées sur ces
 * couleurs et la palette du site (`#fb7185` rouge, `#e879f9` violet, `#818cf8` bleu, `#a78bfa` violet).
 */
export function colorFamily(color: Rgb): ColorFamily {
  const tone = hsl(color);
  if (isNeutral(tone)) return 'neutral';
  const { h } = tone;
  if (h >= 340 || h < 15) return 'red';
  if (h < 45) return 'orange';
  if (h < 72) return 'yellow';
  if (h < 165) return 'green';
  if (h < 195) return 'cyan';
  if (h < 250) return 'blue';
  if (h < 300) return 'purple';
  return 'pink';
}

/** Rang d'une couleur dans le tri : les teintes du rouge au rose, puis les neutres du noir au blanc. */
function colorRank(color: Rgb): number {
  const tone = hsl(color);
  if (isNeutral(tone)) return 1000 + tone.l;
  return tone.h >= 340 ? tone.h - 360 : tone.h;
}

export interface TagItem {
  /** Absent : illisible, jamais caché par la recherche. */
  readonly name: string | undefined;
  readonly count: number | undefined;
  readonly color: Rgb | undefined;
}

/** L'étiquette passe-t-elle les filtres ? Ce qui ne se lit pas ne cache jamais une étiquette. */
export function tagMatches(tag: TagItem, { query, use, family }: TagFilters): boolean {
  const needle = normalizeTagName(query);
  if (needle && tag.name !== undefined && !normalizeTagName(tag.name).includes(needle)) return false;
  if (use !== 'all' && tag.count !== undefined && tag.count > 0 !== (use === 'used')) return false;
  if (family !== 'all' && tag.color && colorFamily(tag.color) !== family) return false;
  return true;
}

/**
 * Étiquettes gardées, dans l'ordre du tri. Elles arrivent dans l'ordre du site (par nom) : c'est le tri « Nom »,
 * et le départage des autres. Une valeur illisible va à la fin.
 */
export function pickTags<T extends TagItem>(tags: readonly T[], filters: TagFilters): T[] {
  const sign = filters.order === 'asc' ? 1 : -1;
  const key = (tag: T): number | undefined =>
    filters.sort === 'count' ? tag.count : filters.sort === 'color' && tag.color ? colorRank(tag.color) : undefined;
  return tags
    .map((tag, index) => ({ tag, index, key: filters.sort === 'name' ? index : key(tag) }))
    .filter(({ tag }) => tagMatches(tag, filters))
    .sort((a, b) => {
      if (a.key === undefined || b.key === undefined) return a.key === b.key ? a.index - b.index : a.key === undefined ? 1 : -1;
      return a.key === b.key ? a.index - b.index : sign * (a.key - b.key);
    })
    .map(({ tag }) => tag);
}

/** Options du filtre des couleurs : les familles présentes et leur nombre d'étiquettes, plus celle choisie. */
export function familyOptions(tags: readonly TagItem[], chosen: ColorFamily | 'all', chipStyle: (color: string) => string): ListboxOption[] {
  const counts = new Map<ColorFamily, number>();
  for (const { color } of tags) {
    if (!color) continue;
    const family = colorFamily(color);
    counts.set(family, (counts.get(family) ?? 0) + 1);
  }
  return [
    { value: 'all', label: 'Toutes les couleurs' },
    ...COLOR_FAMILIES.filter(({ value }) => counts.has(value) || value === chosen).map(({ value, label, sample }) => ({
      value,
      label: `${label} (${counts.get(value) ?? 0})`,
      chipStyle: chipStyle(sample),
    })),
  ];
}
