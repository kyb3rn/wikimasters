/**
 * Ce qu'on sait d'une carte pour décider si sa défausse est permise. Le favori n'en fait pas partie : le site verrouille
 * lui-même un exemplaire en favori (depuis le 10/10/2026), il n'y a rien à protéger de plus.
 */
export interface CardFacts {
  /** Au moins une étiquette sur un de ses exemplaires. */
  readonly tagged: boolean;
  /**
   * Valeur estimée en wikibidous, si connue. Prévue : moyenne des 7 dernières ventes dans la rareté
   * actuelle de la carte. Pas encore de source : viendra avec la gestion des prix du marché.
   */
  readonly value?: number;
}

export interface ProtectionRules {
  readonly tagged: boolean;
  /** Protège au-dessus de cette valeur ; `undefined` : pas de protection par la valeur. */
  readonly minValue?: number;
}

/** Raison de protéger la carte (affichée à l'utilisateur), ou `undefined` si la défausse est permise. */
export function protectionReason(facts: CardFacts, rules: ProtectionRules): string | undefined {
  if (rules.tagged && facts.tagged) return 'carte avec une étiquette';
  if (rules.minValue !== undefined && facts.value !== undefined && facts.value > rules.minValue) {
    return `vaut environ ${Math.round(facts.value)} wikibidous`;
  }
  return undefined;
}
