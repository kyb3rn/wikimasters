import { ROOT_CLASS } from '@/core/dom';

/**
 * Face de carte du site (captures du 29/09/2026), la même partout ; seule sa taille change (`w-72` : modale,
 * carrousel, enchère ; `sm` : grilles ; `w-28` : vignettes) :
 *
 *   div[class*="glow-"].relative.rounded-2xl.overflow-hidden     face (`FACE`)
 *     div.absolute.top-0.left-0.right-0.h-[45%].z-20             image (dégradé noir en bas)
 *     div.absolute.top-2.left-2                                  badge de rareté
 *     div.absolute.top-[45%].bottom-0.flex.flex-col.p-3.z-20     texte
 *       h3 (nom) · p (description)
 *       div.mt-auto.flex.flex-col.pt-1
 *         div.flex.flex-wrap.pb-0.5                              étiquettes (Collection, Échanges)
 *         div.flex.justify-between.border-t.pt-1.py-1            ATK · DEF
 */
export const FACE = '[class*="glow-"]';
/** Face `sm` des grilles (`w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)]`, 160 × 224 px sur ordinateur). */
export const SMALL_FACE = `${FACE}[class*="w-[clamp(8.4rem,43vw,10rem)]"]`;
export const FACE_TEXT = 'div[class*="top-[45%]"]';
/**
 * Bouton en débord sur le coin haut droit d'une face, à côté d'elle dans sa case : « Retirer de la vitrine » de son
 * profil (`absolute -top-2 -right-2 w-6 h-6` : 24 px, centre à 4 px du coin). La face grandit au survol, pas lui.
 */
export const FACE_CORNER_BUTTON = 'button.absolute[class*="-top-"][class*="-right-"]';
/**
 * Case à cocher du mode sélection, à côté de la face dans sa case (Collection ; code du 30/09/2026) :
 * `span.pointer-events-none.absolute.top-1.5.right-1.5.size-6`, à 6 px du coin. La face grandit au survol, pas elle.
 */
export const FACE_SELECTION_BOX = 'span.absolute.top-1\\.5.right-1\\.5';
export const FACE_STATS = `${FACE_TEXT} > div.mt-auto > div.border-t`;

/** Zone de l'image d'une face (positionnée : de quoi y poser une pastille). */
export function findFaceImage(face: Element): HTMLElement | undefined {
  return face.querySelector<HTMLElement>(':scope > div[class*="h-[45%]"]') ?? undefined;
}

export interface CloneFaceOptions {
  /** Copie à regarder seulement : sans ses boutons (favori), ni effets de survol, animations et transitions. */
  readonly inert?: boolean;
}

const LIVELY_CLASS = /^(hover:|cursor-|transition|duration-|animate-)/;

/**
 * Copie d'une face du site, à poser ailleurs : sans nos ajouts (interfaces, tampons, classes `wm-…`, attributs
 * `data-wm-…`) ni identifiants, images chargées tout de suite (`lazy` retarderait celle d'une copie encore cachée,
 * l'image est déjà en cache).
 */
export function cloneSiteFace(face: HTMLElement, { inert = false }: CloneFaceOptions = {}): HTMLElement {
  const clone = face.cloneNode(true) as HTMLElement;
  clone.querySelectorAll(inert ? `.${ROOT_CLASS}, button` : `.${ROOT_CLASS}`).forEach((node) => node.remove());
  for (const element of [clone, ...clone.querySelectorAll('*')]) {
    element.removeAttribute('id');
    const classes = [...element.classList];
    const kept = classes.filter((name) => !name.startsWith('wm-') && !(inert && LIVELY_CLASS.test(name)));
    if (kept.length !== classes.length) element.setAttribute('class', kept.join(' '));
    for (const { name } of [...element.attributes]) if (name.startsWith('data-wm-')) element.removeAttribute(name);
  }
  for (const image of clone.querySelectorAll('img')) image.loading = 'eager';
  return clone;
}
