/**
 * Bouton « Ouvrir » du choix du paquet sur `/pulls` (code du site, 29/09/2026), en colonne `gap-4` :
 *
 *   button.relative.flex.flex-col.items-center.justify-center.gap-4
 *     img (`/card_pack.png` par `/_next/image`, `object-contain` dans un carré w-64 h-64 md:w-72 md:h-72)
 *     span « Ouvrir » (« Ouverture... » pendant l'ouverture)
 *
 * L'image (2550 × 3300) a 12 % de vide transparent en haut et en bas : le texte paraît loin du paquet.
 */
export interface PackButton {
  readonly root: HTMLButtonElement;
  readonly label: HTMLElement;
}

export function findPackButton(doc: Document = document): PackButton | undefined {
  const image = doc.querySelector('main button > img[src*="card_pack"]');
  const root = image?.parentElement;
  const label = image?.nextElementSibling;
  if (!(root instanceof HTMLButtonElement) || !(label instanceof HTMLElement)) return undefined;
  return { root, label };
}
