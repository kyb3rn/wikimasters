import { ROOT_CLASS } from '@/core/dom';

export const text = (element: Element | null | undefined) => (element?.textContent ?? '').replace(/\s+/g, ' ').trim();

export function siteButtons(root: Element): HTMLButtonElement[] {
  return [...root.querySelectorAll('button')].filter((button) => !button.closest(`.${ROOT_CLASS}`));
}

/** Étoile d'une face de carte : « Ajouter aux favoris » ou « Retirer des favoris ». */
export function findStarButton(face: Element): HTMLButtonElement | undefined {
  return face.querySelector<HTMLButtonElement>('button[aria-label*="favoris"]') ?? undefined;
}
