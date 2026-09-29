/** Ce qu'on sait d'une carte pour décider si sa défausse est permise. */
export interface CardFacts {
  /** En favori (un de ses exemplaires, le site les met tous). */
  readonly starred: boolean;
  /** Au moins une étiquette sur un de ses exemplaires. */
  readonly tagged: boolean;
  /**
   * Valeur estimée en wikibidous, si connue. Prévue : moyenne des 7 dernières ventes dans la rareté
   * actuelle de la carte. Pas encore de source : viendra avec la gestion des prix du marché.
   */
  readonly value?: number;
}

export interface ProtectionRules {
  readonly starred: boolean;
  readonly tagged: boolean;
  /** Protège au-dessus de cette valeur ; `undefined` : pas de protection par la valeur. */
  readonly minValue?: number;
}

/** Raison de protéger la carte (affichée à l'utilisateur), ou `undefined` si la défausse est permise. */
export function protectionReason(facts: CardFacts, rules: ProtectionRules): string | undefined {
  if (rules.starred && facts.starred) return 'carte en favori';
  if (rules.tagged && facts.tagged) return 'carte avec une étiquette';
  if (rules.minValue !== undefined && facts.value !== undefined && facts.value > rules.minValue) {
    return `vaut environ ${Math.round(facts.value)} wikibidous`;
  }
  return undefined;
}
