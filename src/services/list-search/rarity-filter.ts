import { Fragment, h, type ComponentChildren } from 'preact';
import { setHidden, watchDom } from '@/core/dom';
import type { Rarity } from '@/site/rarity';
import type { RarityPills } from '@/site/rarity-pills';
import { createSlot } from '@/ui/mount';
import { RarityFilter } from './RarityFilter';

/** Rangée des pastilles du site (et son bouton qui décoche tout), cachée : nos cases les cliquent. */
const OWNER = 'rarity-filter';

/** Où poser les cases : dans `parent`, juste avant `before` (à la fin s'il est nul). */
export interface RarityFilterSpot {
  readonly parent: HTMLElement;
  readonly before: Element | null;
  readonly pills: RarityPills;
}

export interface RarityFilterOptions {
  readonly signal: AbortSignal;
  readonly locate: () => RarityFilterSpot | undefined;
  /** Contrôles à nous posés juste après les cases (même conteneur). */
  readonly after?: () => ComponentChildren;
}

/**
 * Les pastilles de rareté du site deviennent des cases collées, à la hauteur des champs, cochées dans la
 * couleur de la rareté. Chaque case clique la pastille du site (cachée) : le filtre reste le sien.
 * Idempotent (`watchDom`) ; à l'interruption de `signal`, les cases sont retirées et les pastilles que cette
 * instance a cachées rendues (plusieurs instances par page : collection d'un ami et choix d'une carte de vitrine).
 */
export function placeRarityFilter({ signal, locate, after }: RarityFilterOptions): void {
  const slot = createSlot(signal);
  const hidden = new Set<Element>();

  const toggle = (rarity: Rarity) => locate()?.pills.pills.find((pill) => pill.rarity === rarity)?.button.click();
  const reset = () => locate()?.pills.reset?.click();

  function sync(): void {
    const spot = locate();
    if (!spot) {
      slot.clear();
      return;
    }
    const { row, pills } = spot.pills;
    for (const old of hidden) if (!old.isConnected) hidden.delete(old);
    hidden.add(row);
    setHidden(row, OWNER, true);
    const vnode = h(
      Fragment,
      null,
      h(RarityFilter, {
        rarities: pills.map((pill) => pill.rarity),
        checked: new Set(pills.filter((pill) => pill.checked).map((pill) => pill.rarity)),
        onToggle: toggle,
        onReset: reset,
      }),
      after?.(),
    );
    slot.render(vnode, { parent: spot.parent, before: spot.before, inline: true });
  }

  watchDom(sync, { signal });
  signal.addEventListener('abort', () => hidden.forEach((row) => setHidden(row, OWNER, false)), { once: true });
}
