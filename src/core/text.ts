/** Texte tel qu'il se lit : blancs (retours à la ligne, espaces insécables compris) réduits à un espace, bords coupés. */
export function normalizeText(text: string | null | undefined): string {
  return (text ?? '').replace(/\s+/g, ' ').trim();
}

/** Texte affiché d'un nœud et de ses descendants, normalisé (`normalizeText`). */
export function textOf(node: Node | null | undefined): string {
  return normalizeText(node?.textContent);
}
