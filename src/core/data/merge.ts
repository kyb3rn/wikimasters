import type { ImportCounts } from './types';

/** Sort d'un élément du fichier à la fusion. */
export type MergeOutcome = 'added' | 'updated' | 'unchanged';

/** Même contenu (JSON identique, ordre des clés compris). */
export const sameJson = (a: unknown, b: unknown): boolean => JSON.stringify(a) === JSON.stringify(b);

export function tally(outcomes: Iterable<MergeOutcome>, invalid: number): ImportCounts {
  const counts = { added: 0, updated: 0, unchanged: 0, invalid };
  for (const outcome of outcomes) counts[outcome]++;
  return counts;
}

/** Taille approximative d'une valeur (caractères de son JSON). */
export const jsonSize = (value: unknown): number => JSON.stringify(value)?.length ?? 0;
