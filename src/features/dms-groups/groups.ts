/** Écart au-delà duquel deux messages qui se suivent ne sont plus groupés (demande de l'utilisateur). */
export const GROUP_GAP_MS = 60_000;

/** Message (son auteur, sa date si elle est connue) ou autre élément de la conversation (échange, annonce). */
export type GroupItem = { readonly sender: string; readonly at: number | undefined } | undefined;

export interface GroupLinks {
  /** Groupé avec le précédent. */
  readonly prev: boolean;
  /** Groupé avec le suivant. */
  readonly next: boolean;
}

/**
 * Groupes de messages, comme Instagram : un message rejoint le précédent s'il est du même auteur et envoyé moins
 * d'une minute après lui (de proche en proche). Un échange, une annonce, ou une date inconnue, coupe le groupe.
 */
export function groupLinks(items: readonly GroupItem[], gapMs = GROUP_GAP_MS): GroupLinks[] {
  const joined = (a: GroupItem, b: GroupItem): boolean =>
    a !== undefined && b !== undefined && a.sender === b.sender && a.at !== undefined && b.at !== undefined &&
    b.at - a.at >= 0 && b.at - a.at < gapMs;
  return items.map((item, index) => ({
    prev: index > 0 && joined(items[index - 1], item),
    next: index < items.length - 1 && joined(item, items[index + 1]),
  }));
}
