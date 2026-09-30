import { findRarityPills, type RarityPills } from '@/site/rarity-pills';

/**
 * « Choisir une carte » de sa vitrine (code du site du 30/09/2026), ouverte par une case « Ajouter » : portail
 * dans `body`, fond `div.fixed.inset-0`, cadre `w-full max-w-md max-h-[85vh] … flex flex-col` ; en-tête (`h3`
 * « Choisir une carte », nom de la galerie dessous s'il y en a plusieurs) ; `div.px-5.py-3.space-y-3` : champ
 * « Rechercher une carte... » (`q` de `/api/my-collection`, comme la Collection, 300 ms après la frappe) et
 * pastilles de rareté en petit ; zone qui défile (`flex-1 overflow-y-auto px-5 pb-5`) : grille `gap-4 py-2` de
 * 20 cartes par page, pagination ← n / total →. La guilde a sa propre « Choisir une carte » (Annuler / Valider),
 * sans pastilles.
 */
export interface CardPicker {
  readonly frame: HTMLElement;
  /** Rangée du champ et des pastilles. */
  readonly search: HTMLElement;
  readonly field: HTMLInputElement;
  readonly pills: RarityPills;
  /** Zone qui défile, sous la recherche : cartes (ou roue, message) et pagination. */
  readonly list: HTMLElement | undefined;
}

export function findCardPicker(doc: Document = document): CardPicker | undefined {
  for (const overlay of doc.querySelectorAll<HTMLElement>('div.fixed.inset-0')) {
    const frame = overlay.firstElementChild;
    if (!(frame instanceof HTMLElement) || frame.querySelector('h3')?.textContent?.trim() !== 'Choisir une carte') continue;
    const pills = findRarityPills(frame);
    const search = pills?.row.parentElement;
    const field = search?.querySelector<HTMLInputElement>(':scope > input[type="text"]');
    const list = search?.nextElementSibling;
    if (pills && search && field) return { frame, search, field, pills, list: list instanceof HTMLElement ? list : undefined };
  }
  return undefined;
}
