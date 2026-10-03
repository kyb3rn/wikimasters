/**
 * Texte comparable comme le fait le site (`normalizeCardSearchText`, code du 29/09/2026) : sans accents ni casse,
 * espaces réduits. Recherches (titres, catégories, pseudos) et noms d'étiquettes.
 */
export function normalizeSearchText(text: string): string {
  return text.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().trim().split(/\s+/).filter(Boolean).join(' ');
}
