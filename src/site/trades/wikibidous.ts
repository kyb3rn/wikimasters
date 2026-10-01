/** Montant le plus haut par joueur dans un échange (champ du site et contrôle de l'envoi). */
export const TRADE_WIKIBIDOUS_MAX = 10_000;

/** Saisie d'un montant comme le champ du site : espaces ignorés, entier, négatif ou illisible = 0, plafonné. */
export function parseTradeWikibidous(text: string): number {
  const value = Math.floor(Number(text.replace(/\s/g, '')));
  return !Number.isFinite(value) || value < 0 ? 0 : Math.min(value, TRADE_WIKIBIDOUS_MAX);
}
