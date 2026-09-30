/**
 * Étiquettes telles que le site les dessine (code du site, 29/09/2026) : pastille `rounded-full border`
 * teintée de leur couleur (`siteClass.tagChip`, style `tagChipStyle`), couleur tirée au hasard d'une palette pour
 * une nouvelle.
 */
/** Couleurs proposées pour une nouvelle étiquette. */
export const TAG_PALETTE = [
  '#f472b6', '#c084fc', '#a78bfa', '#818cf8', '#60a5fa', '#38bdf8', '#2dd4bf',
  '#4ade80', '#facc15', '#fb923c', '#fb7185', '#e879f9', '#5eead4', '#86efac',
];
const DEFAULT_COLOR = '#94a3b8';

/** Longueur maximale d'un nom d'étiquette. */
export const TAG_NAME_MAX = 48;

export function randomTagColor(): string {
  return TAG_PALETTE[Math.floor(Math.random() * TAG_PALETTE.length)] ?? DEFAULT_COLOR;
}

function rgb(color: string | undefined): [number, number, number] {
  const hex = /^#([0-9a-f]{6})$/i.exec((color ?? '').trim())?.[1] ?? DEFAULT_COLOR.slice(1);
  const value = Number.parseInt(hex, 16);
  return [(value >> 16) & 255, (value >> 8) & 255, value & 255];
}

/** Style en ligne de la pastille (`tagChipSurfaceStyles` du site). */
export function tagChipStyle(color: string | undefined): string {
  const [r, g, b] = rgb(color);
  return `background-color: rgba(${r}, ${g}, ${b}, 0.22); border-color: rgba(${r}, ${g}, ${b}, 0.5); color: rgba(248, 250, 252, 0.95);`;
}

/** Nom comparable (`normalizeCardSearchText` du site) : sans accents ni casse, espaces réduits. */
export function normalizeTagName(name: string): string {
  return name.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ');
}
