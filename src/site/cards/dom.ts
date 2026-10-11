/**
 * Étoile d'une face de carte (code du site du 10/10/2026) : sur mes exemplaires, « Ajouter aux favoris (verrouille
 * la carte : ni défausse, ni vente, ni échange) » ou « Retirer des favoris (déverrouille la carte) » ; sur
 * l'exemplaire d'un ami, « Pas en favori chez <pseudo> » ou « En favori chez <pseudo> : carte verrouillée ».
 */
export function findStarButton(face: Element): HTMLButtonElement | undefined {
  return face.querySelector<HTMLButtonElement>('button[aria-label*="favori"]') ?? undefined;
}

export interface StarState {
  readonly starred: boolean;
  /** Étoile de l'exemplaire d'un ami (« … chez <pseudo> »). */
  readonly friend: boolean;
}

/**
 * Libellés lus par leur début : le site leur a ajouté une précision le 10/10/2026 (avant : « Ajouter aux favoris »
 * seul), et un libellé inconnu comptait alors toute carte en favori. Inconnu : en favori, par prudence.
 */
export function parseStarLabel(label: string, filled: boolean): StarState {
  const off = /^(Ajouter aux favoris|Pas en favori chez )/.test(label);
  return { starred: filled || !off, friend: /^(Pas en|En) favori chez /.test(label) };
}
