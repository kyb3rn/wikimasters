import { Fragment, h, type ComponentChildren } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom } from '@/core/dom';
import type { Rarity } from '@/site/rarity';
import type { RarityPills } from '@/site/rarity-pills';
import { mountUi, type MountedUi } from '@/ui/mount';
import { RarityFilter } from './RarityFilter';

/** Rangée des pastilles du site (et son bouton qui décoche tout), cachée : nos cases les cliquent. */
const PILLS = 'wm-rarity-pills';

const CSS = `.${PILLS} { display: none !important; }`;

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
 * Idempotent (`watchDom`), retiré à l'interruption de `signal`.
 */
export function placeRarityFilter({ signal, locate, after }: RarityFilterOptions): void {
  let placed: { ui: MountedUi; controller: AbortController } | undefined;
  injectStyle('rarity-filter', CSS);

  const toggle = (rarity: Rarity) => locate()?.pills.pills.find((pill) => pill.rarity === rarity)?.button.click();
  const reset = () => locate()?.pills.reset?.click();

  function sync(): void {
    const spot = locate();
    if (!spot) {
      placed?.controller.abort();
      placed = undefined;
      return;
    }
    setClass(spot.pills.row, PILLS, true);
    const vnode = h(
      Fragment,
      null,
      h(RarityFilter, {
        rarities: spot.pills.pills.map((pill) => pill.rarity),
        checked: new Set(spot.pills.pills.filter((pill) => pill.checked).map((pill) => pill.rarity)),
        onToggle: toggle,
        onReset: reset,
      }),
      after?.(),
    );
    if (placed?.ui.element.parentElement === spot.parent && placed.ui.element.nextElementSibling === spot.before) {
      placed.ui.update(vnode);
      return;
    }
    placed?.controller.abort();
    const controller = childController(signal);
    placed = { ui: mountUi(vnode, { parent: spot.parent, before: spot.before, inline: true, signal: controller.signal }), controller };
  }

  watchDom(sync, { signal });
  signal.addEventListener('abort', () => document.querySelectorAll(`.${PILLS}`).forEach((el) => el.classList.remove(PILLS)), {
    once: true,
  });
}
