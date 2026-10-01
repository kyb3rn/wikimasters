import { isRecord } from '@/core/guards';
import { parseRarity, type Rarity } from '@/site/rarity';

/** Une carte (modèle), pas un exemplaire : ce qu'il faut pour l'historique de ses ventes. */
export interface CardRef {
  readonly id: string;
  readonly title: string;
  /** Rareté de la carte, ou de l'exemplaire affiché ; inconnue : `undefined`. */
  readonly rarity: Rarity | undefined;
}

/** Carte telle que le site la donne (`{ id, wikipedia_title, rarity, … }`) ; `undefined` sans id ni titre. */
export function parseCardRef(raw: unknown): CardRef | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, wikipedia_title: title, rarity } = raw;
  if (typeof id !== 'string' || id === '' || typeof title !== 'string') return undefined;
  return { id, title: title.trim(), rarity: parseRarity(rarity) };
}
