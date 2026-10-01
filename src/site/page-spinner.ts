/**
 * Bloc qui tient lieu de page entière : unique enfant de `<main>`, en `flex-1` (rond de chargement, « Profil
 * introuvable », « Enchère introuvable »…). Le site le prévoit centré, mais `<main>` n'est pas flex.
 */
export function soleMainChild(main: Element): HTMLElement | undefined {
  const page = main.firstElementChild;
  return page instanceof HTMLElement && page === main.lastElementChild && page.classList.contains('flex-1') ? page : undefined;
}

/**
 * Pendant le chargement de ses données, chaque page (Collection, Marché, une enchère, Échanges, Amis,
 * profils, /pulls…) affiche à la place de son contenu un rond qui tourne, unique enfant de `<main>` :
 * `div.flex-1.flex.items-center.justify-center` › `div.w-8.h-8.border-2.….rounded-full.animate-spin`.
 * Relevé dans le code du site le 29/09/2026.
 */
export function showsPageSpinner(main: Element): boolean {
  const page = soleMainChild(main);
  return page?.childElementCount === 1 && page.firstElementChild?.classList.contains('animate-spin') === true;
}
