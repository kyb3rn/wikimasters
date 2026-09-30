/** Page du profil d'un joueur : `/profile/<pseudo>` (les pseudos peuvent contenir des espaces, `!`, des émojis). */
export function profilePath(username: string): string {
  return `/profile/${encodeURIComponent(username)}`;
}
