import { RARITIES, type Rarity } from '@/site/rarity';

/**
 * Pastilles de rareté de /collection (code et captures du 29/09/2026) : rangée `div.flex.flex-wrap.gap-2` sous
 * le champ de recherche et les listes, une pastille par rareté (L UR SR R PC C), colorée en style
 * (`var(--color-rarity-…)`) ; cochée : `ring-2 ring-white/30`, sinon `opacity-50`. « Réinitialiser rareté »
 * s'ajoute dès qu'une est cochée. Un clic coche ou décoche, remet la page à 0 et relance la liste (`rarity=`
 * répété, une par rareté cochée).
 */
export interface RarityPill {
  readonly rarity: Rarity;
  readonly button: HTMLButtonElement;
  readonly checked: boolean;
}

export interface RarityPills {
  readonly row: HTMLElement;
  readonly pills: readonly RarityPill[];
  /** « Réinitialiser rareté » : l'autre bouton de la rangée, présent dès qu'une rareté est cochée. */
  readonly reset: HTMLButtonElement | undefined;
}

export function findRarityPills(doc: Document = document): RarityPills | undefined {
  const pills: RarityPill[] = [];
  for (const button of doc.querySelector('main')?.querySelectorAll<HTMLButtonElement>('button[style*="--color-rarity-"]') ?? []) {
    const rarity = RARITIES.find((name) => name === button.textContent?.trim());
    if (!rarity || button.closest('.wm-root, div.fixed.inset-0')) continue;
    pills.push({ rarity, button, checked: button.classList.contains('ring-2') });
  }
  const row = pills[0]?.button.parentElement;
  if (!row || pills.some((pill) => pill.button.parentElement !== row)) return undefined;
  const reset = [...row.querySelectorAll<HTMLButtonElement>(':scope > button')].find((button) => !pills.some((pill) => pill.button === button));
  return { row, pills, reset };
}
