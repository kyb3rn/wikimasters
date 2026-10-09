import { describe, expect, it } from 'vitest';
import { colorFamily, DEFAULT_FILTERS, familyOptions, pickTags, type TagFilters, type TagItem } from '@/features/tag-manager/filters';

type Rgb = readonly [number, number, number];

interface Tag extends TagItem {
  readonly id: string;
}

const tag = (id: string, name: string | undefined, count: number | undefined, color: Rgb | undefined): Tag => ({ id, name, count, color });

const RED: Rgb = [255, 0, 0];
const BLUE: Rgb = [96, 165, 250];
const GREEN: Rgb = [134, 239, 172];
const BLACK: Rgb = [0, 0, 0];
const WHITE: Rgb = [255, 255, 255];

/** Dans l'ordre du site : par nom. */
const TAGS: readonly Tag[] = [
  tag('a', 'automobile', 53, BLUE),
  tag('b', 'égypte', 10, RED),
  tag('c', 'ferroviaire', 0, BLACK),
  tag('d', 'Géographie', 103, GREEN),
  tag('e', 'trade', 424, WHITE),
  tag('f', 'vitamines', 0, BLUE),
];

const ids = (filters: Partial<TagFilters>, tags: readonly Tag[] = TAGS) => pickTags(tags, { ...DEFAULT_FILTERS, ...filters }).map((t) => t.id);

describe('colorFamily', () => {
  it.each([
    [[255, 0, 0], 'red'],
    [[251, 113, 133], 'red'], // #fb7185 de la palette du site
    [[179, 25, 66], 'red'], // cramoisi
    [[91, 36, 36], 'red'], // brun-rouge sombre
    [[255, 155, 112], 'orange'],
    [[227, 182, 120], 'orange'],
    [[255, 174, 0], 'orange'],
    [[253, 212, 63], 'yellow'],
    [[194, 187, 0], 'yellow'],
    [[205, 234, 97], 'green'],
    [[205, 255, 204], 'green'], // très clair, mais teinté
    [[78, 111, 77], 'green'],
    [[0, 168, 146], 'cyan'],
    [[38, 229, 232], 'cyan'],
    [[0, 89, 128], 'blue'],
    [[129, 140, 248], 'blue'], // #818cf8
    [[22, 32, 111], 'blue'],
    [[167, 139, 250], 'purple'], // #a78bfa
    [[59, 22, 95], 'purple'],
    [[232, 121, 249], 'purple'], // #e879f9
    [[255, 51, 211], 'pink'],
    [[244, 114, 182], 'pink'],
    [[0, 0, 0], 'neutral'],
    [[48, 48, 48], 'neutral'],
    [[161, 161, 161], 'neutral'],
    [[255, 255, 255], 'neutral'],
  ] as const)('%j → %s', (color, family) => {
    expect(colorFamily(color)).toBe(family);
  });
});

describe('pickTags', () => {
  it('sans filtre : tout, dans l’ordre du site', () => {
    expect(ids({})).toEqual(['a', 'b', 'c', 'd', 'e', 'f']);
  });

  it('recherche dans le nom, sans accents ni casse', () => {
    expect(ids({ query: 'EGY' })).toEqual(['b']);
    expect(ids({ query: 'géo' })).toEqual(['d']);
    expect(ids({ query: '  a ' })).toEqual(['a', 'c', 'd', 'e', 'f']);
    expect(ids({ query: 'zzz' })).toEqual([]);
  });

  it('avec des cartes, sans carte', () => {
    expect(ids({ use: 'used' })).toEqual(['a', 'b', 'd', 'e']);
    expect(ids({ use: 'empty' })).toEqual(['c', 'f']);
  });

  it('famille de couleurs, filtres cumulés', () => {
    expect(ids({ family: 'blue' })).toEqual(['a', 'f']);
    expect(ids({ family: 'neutral' })).toEqual(['c', 'e']);
    expect(ids({ family: 'blue', use: 'empty' })).toEqual(['f']);
    expect(ids({ family: 'blue', query: 'auto' })).toEqual(['a']);
  });

  it('tri par nom : l’ordre du site, ou l’inverse', () => {
    expect(ids({ sort: 'name', order: 'desc' })).toEqual(['f', 'e', 'd', 'c', 'b', 'a']);
  });

  it('tri par nombre de cartes, égalités dans l’ordre du site', () => {
    expect(ids({ sort: 'count', order: 'desc' })).toEqual(['e', 'd', 'a', 'b', 'c', 'f']);
    expect(ids({ sort: 'count', order: 'asc' })).toEqual(['c', 'f', 'b', 'a', 'd', 'e']);
  });

  it('tri par couleur : du rouge au rose, puis les neutres du noir au blanc', () => {
    expect(ids({ sort: 'color' })).toEqual(['b', 'd', 'a', 'f', 'c', 'e']);
    expect(ids({ sort: 'color', order: 'desc' })).toEqual(['e', 'c', 'a', 'f', 'd', 'b']);
  });

  it('une valeur illisible ne cache rien et va à la fin du tri', () => {
    const tags = [tag('x', undefined, undefined, undefined), ...TAGS];
    expect(ids({ query: 'trade', use: 'empty', family: 'red' }, tags)).toEqual(['x']);
    expect(ids({ sort: 'count', order: 'desc' }, tags).at(-1)).toBe('x');
    expect(ids({ sort: 'color' }, tags).at(-1)).toBe('x');
  });
});

describe('familyOptions', () => {
  const chip = (color: string) => `chip ${color}`;

  it('les familles présentes, avec leur nombre, dans l’ordre des couleurs', () => {
    expect(familyOptions(TAGS, 'all', chip)).toEqual([
      { value: 'all', label: 'Toutes les couleurs' },
      { value: 'red', label: 'Rouges (1)', chipStyle: 'chip #ef4444' },
      { value: 'green', label: 'Verts (1)', chipStyle: 'chip #4ade80' },
      { value: 'blue', label: 'Bleus (2)', chipStyle: 'chip #60a5fa' },
      { value: 'neutral', label: 'Noirs, gris, blancs (2)', chipStyle: 'chip #94a3b8' },
    ]);
  });

  it('la famille choisie reste proposée quand sa dernière étiquette a disparu', () => {
    expect(familyOptions(TAGS, 'pink', chip).map((option) => option.label)).toContain('Roses (0)');
  });
});
