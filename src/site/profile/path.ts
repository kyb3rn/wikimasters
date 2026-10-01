import { MY_PROFILE_ROUTE } from '@/site/routes';

/** Page du profil d'un joueur : `/profile/<pseudo>` (les pseudos peuvent contenir des espaces, `!`, des émojis). */
export function profilePath(username: string): string {
  return `${MY_PROFILE_ROUTE}/${encodeURIComponent(username)}`;
}
