/** Montant saisi : le texte tel quel (remis à l'identique) et sa valeur. */
export interface TypedAmount {
  readonly text: string;
  readonly amount: number;
}

/** Montant lu dans le champ ; aucun s'il est vide (un champ nombre rend aussi une saisie incomplète vide). */
export function readTyped(text: string): TypedAmount | undefined {
  if (text.trim() === '') return undefined;
  const amount = Number(text);
  return Number.isFinite(amount) ? { text, amount } : undefined;
}

/**
 * Le montant saisi tient-il face à ce que le site vient d'écrire dans le champ ? Le site n'y écrit que sa mise
 * minimum, parfois plus haute que l'attribut `min` (refus `bid_too_low` après des mises manquées : il écrit le minimum
 * du refus sans relire l'enchère) : il doit atteindre les deux.
 */
export function keepsTyped(typed: TypedAmount, written: string, min: string): boolean {
  return [written, min].every((floor) => {
    const amount = readTyped(floor)?.amount;
    return amount === undefined || typed.amount >= amount;
  });
}
