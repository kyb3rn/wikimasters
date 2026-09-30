/**
 * Face de carte du site (captures du 29/09/2026), la même partout ; seule sa taille change (`w-72` : modale,
 * carrousel, enchère ; `sm` : grilles ; `w-28` : vignettes) :
 *
 *   div[class*="glow-"].relative.rounded-2xl.overflow-hidden     face
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
export const FACE_STATS = `${FACE_TEXT} > div.mt-auto > div.border-t`;

/** Zone de l'image d'une face (positionnée : de quoi y poser une pastille). */
export function findFaceImage(face: Element): HTMLElement | undefined {
  return face.querySelector<HTMLElement>(':scope > div[class*="h-[45%]"]') ?? undefined;
}
