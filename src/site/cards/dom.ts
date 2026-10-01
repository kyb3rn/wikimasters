/** Étoile d'une face de carte : « Ajouter aux favoris » ou « Retirer des favoris ». */
export function findStarButton(face: Element): HTMLButtonElement | undefined {
  return face.querySelector<HTMLButtonElement>('button[aria-label*="favoris"]') ?? undefined;
}
