/** Raretés du site, de la plus haute à la plus basse (ordre de ses filtres et de ses tris). */
export const RARITIES = ['L', 'UR', 'SR', 'R', 'PC', 'C'] as const;

export type Rarity = (typeof RARITIES)[number];

export const RARITY_NAMES: Readonly<Record<Rarity, string>> = {
  L: 'Légendaire',
  UR: 'Ultra rare',
  SR: 'Super rare',
  R: 'Rare',
  PC: 'Peu commune',
  C: 'Commune',
};

/** Couleur de la rareté (variable du thème du site). */
export const rarityColor = (rarity: Rarity): string => `var(--color-rarity-${rarity.toLowerCase()})`;

/** Couleurs du badge de rareté de la modale de carte (code du site) : texte blanc sur C, foncé sur les autres. */
export const rarityBadgeStyle = (rarity: Rarity) => ({
  backgroundColor: rarityColor(rarity),
  color: rarity === 'C' ? '#fff' : '#0f0f1a',
});

export function parseRarity(value: unknown): Rarity | undefined {
  return typeof value === 'string' ? RARITIES.find((rarity) => rarity === value.trim().toUpperCase()) : undefined;
}
