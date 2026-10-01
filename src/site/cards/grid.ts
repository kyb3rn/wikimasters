import { isOwn } from '@/site/dom';
import { FACE } from './face';

/**
 * Grilles de cartes du site (captures du 29/09/2026) : rangée `flex flex-wrap justify-center` dont chaque enfant
 * est une case, qui contient une face (composant commun, taille `sm` : 160 × 224 px sur ordinateur).
 *
 * | Page | Rangée | Case |
 * |---|---|---|
 * | Collection | `gap-3 sm:gap-[22px] md:gap-[26px]` | `div.relative.isolate.group` > face (+ calque et case à cocher en sélection) |
 * | Toutes les cartes | idem | la face elle-même |
 * | Profils (vitrines, collection) | idem | `div.relative` > face ; « Choisir une carte » (modale) : `gap-4` |
 * | Marché (tous les onglets) | `gap-4 md:gap-5` | vignette `div#marketplace-auction-<id>` (`w-[184px]`, face, prix, durée) |
 * | Échanges (modale, choix des cartes) | `gap-3`, en `grid grid-cols-2` sous 500 px (`min-[500px]:flex-wrap`) | `button` > face |
 *
 * Ailleurs (modale de carte, carrousel de /pulls), la grande face (`w-72`) n'est dans aucune rangée `flex-wrap`.
 */
const MAX_DEPTH = 6;

const isWrapRow = (element: Element) =>
  [...element.classList].some((name) => name === 'flex-wrap' || name.endsWith(':flex-wrap'));

/** Rangées du site qui contiennent des faces de cartes (hors nos interfaces). */
export function findCardGrids(root: ParentNode = document): HTMLElement[] {
  const grids = new Set<HTMLElement>();
  for (const face of root.querySelectorAll<HTMLElement>(FACE)) {
    if (!face.querySelector('h3') || face.parentElement?.closest(FACE) || isOwn(face)) continue;
    let element = face.parentElement;
    for (let depth = 0; element && depth < MAX_DEPTH; depth++, element = element.parentElement) {
      if (isWrapRow(element)) {
        grids.add(element);
        break;
      }
    }
  }
  return [...grids];
}
