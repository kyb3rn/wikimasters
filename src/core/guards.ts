/** Objet simple (ni tableau, ni null) : pour valider des données relues (stockage, API). */
export function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isSet(value: unknown): value is Set<unknown> {
  return value instanceof Set;
}

/** Valeur d'un texte JSON, à valider ; `undefined` s'il est invalide. */
export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return undefined;
  }
}
