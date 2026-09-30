import { RARITIES, type Rarity } from './rarity';

/**
 * Pastilles de rareté des filtres du site (Collection, Toutes les cartes, Marché ; code du 29 et 30/09/2026) :
 * rangée `div.flex.flex-wrap.gap-2`, une pastille par rareté (L UR SR R PC C), colorée en style
 * (`var(--color-rarity-…)`) ; cochée : `ring-2 ring-white/30`, sinon `opacity-50`. « Réinitialiser rareté »
 * (« Réinitialiser » au marché) s'ajoute dès qu'une est cochée. Plusieurs à la fois (`rarity=` répété).
 * D'autres boutons peuvent partager la rangée (« Liste de souhaits » de Toutes les cartes). Même composant, en
 * petit (`px-2.5 py-0.5 text-[11px]`), dans « Choisir une carte » de la vitrine du profil.
 */
export interface RarityPill {
  readonly rarity: Rarity;
  readonly button: HTMLButtonElement;
  readonly checked: boolean;
}

export interface RarityPills {
  readonly row: HTMLElement;
  readonly pills: readonly RarityPill[];
  /** Bouton qui décoche tout, présent dès qu'une rareté est cochée. */
  readonly reset: HTMLButtonElement | undefined;
}

/** Pastilles de `scope` (la page par défaut), hors nos interfaces et hors modales du site (sauf si `scope` y est). */
export function findRarityPills(scope: ParentNode | null = document.querySelector('main')): RarityPills | undefined {
  const pills: RarityPill[] = [];
  for (const button of scope?.querySelectorAll<HTMLButtonElement>('button[style*="--color-rarity-"]') ?? []) {
    const rarity = RARITIES.find((name) => name === button.textContent?.trim());
    const overlay = button.closest('div.fixed.inset-0');
    if (!rarity || button.closest('.wm-root') || (overlay && !(scope instanceof Node && overlay.contains(scope)))) continue;
    pills.push({ rarity, button, checked: button.classList.contains('ring-2') });
  }
  const row = pills[0]?.button.parentElement;
  if (!row || pills.some((pill) => pill.button.parentElement !== row)) return undefined;
  const reset = [...row.querySelectorAll<HTMLButtonElement>(':scope > button')].find((button) =>
    button.textContent?.trim().startsWith('Réinitialiser'),
  );
  return { row, pills, reset };
}
