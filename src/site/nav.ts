import { PULLS_ROUTE } from './routes';

/*
 * Menu latéral du site, sur ordinateur (à partir de 768 px ; capture du 03/10/2026) :
 *
 *   nav.hidden.w-64.flex-col.gap-2.….p-6.md:flex
 *     div.flex.items-center.justify-between.gap-2.mb-8   logo (a[href=/pulls] > h1) et cloche
 *     a × 13                                           Paquets … Paramètres
 *
 * Sur téléphone, une autre barre (`nav.md:hidden`, en bas) : jamais touchée (le script est fait pour ordinateur). Un
 * lien est allumé d'après le début du chemin : sur `/collection?vue=…`, c'est encore « Collection ».
 */

/** Le menu latéral, reconnu au logo de sa première rangée. */
export const SIDE_NAV = `nav:has(> div > a[href="${PULLS_ROUTE}"] > h1)`;

/** Lien du menu vers `href` (sélecteur CSS). */
export function sideNavLink(href: string): string {
  return `${SIDE_NAV} > a[href="${href}"]`;
}

/** Point à droite du lien allumé. */
export const SIDE_NAV_DOT = 'div.ml-auto.rounded-full';

export function findSideNav(root: ParentNode = document): HTMLElement | undefined {
  return root.querySelector<HTMLElement>(SIDE_NAV) ?? undefined;
}

/** Rangée du logo et de la cloche, en tête du menu. */
export function sideNavHead(nav: Element): Element | undefined {
  const head = nav.firstElementChild;
  return head?.querySelector(`a[href="${PULLS_ROUTE}"] > h1`) ? head : undefined;
}
