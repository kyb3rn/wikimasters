/** Objet simple (ni tableau, ni null) : pour valider des données relues (stockage, API). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
