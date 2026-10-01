import { FRIENDS_ROUTE } from '@/site/routes';
import { soleMainChild } from '@/site/page-spinner';

/**
 * Profil inexistant ou refusé (capture du 30/09/2026) : unique enfant de `<main>`,
 * `div.flex-1.flex.flex-col.items-center.justify-center` › cadenas lucide, « Profil introuvable », lien
 * « ← Retour aux amis » (`/friends`). Reconnu au cadenas et au lien, pas au texte.
 */
export function showsProfileNotFound(main: Element): boolean {
  const page = soleMainChild(main);
  return (
    page !== undefined &&
    page.classList.contains('justify-center') &&
    page.querySelector(':scope > svg.lucide-lock') !== null &&
    page.querySelector(`:scope > a[href="${FRIENDS_ROUTE}"]`) !== null
  );
}
