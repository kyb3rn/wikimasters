import type { ComponentChild } from 'preact';
import { onListingsChange } from '@/services/listings';
import { findPullsGrid, onPullsGridChange } from '@/services/pulls-grid';
import { createSlots, type Placement } from '@/ui/mount';
import { ACTION_START, onCarouselLockChange } from './lock';
import { onPackChange, packCarousel, type OpenPack } from './pack';

/**
 * Place d'un bouton parmi nos actions sur une carte : `start` en tête (juste après les pastilles du carrousel),
 * `end` en dernier (juste avant la flèche « suivante »).
 */
export type PackActionPlace = 'start' | 'end';

/** Carte que vise un bouton d'action. */
export interface PackActionTarget {
  readonly pack: OpenPack;
  /** Position dans le paquet (-1 : aucune carte affichée dans le carrousel). */
  readonly index: number;
  /** Sous une carte de la grille ; sinon dans la rangée du carrousel, pour la carte affichée. */
  readonly inGrid: boolean;
}

export interface PackActions {
  /** Boutons posés là où le paquet est affiché (rangée du carrousel, ou sous chaque carte de la grille). Idempotent. */
  sync(): void;
}

/** Un bouton d'action par carte du paquet affiché, rendu par `render` ; tous retirés à l'interruption du signal. */
export function packActions(
  render: (target: PackActionTarget) => ComponentChild,
  options: { readonly place: PackActionPlace; readonly signal: AbortSignal },
): PackActions {
  const slots = createSlots<HTMLElement>(options.signal);
  const start = options.place === 'start';
  return {
    sync() {
      const found = packCarousel();
      if (!found) {
        slots.clearAll();
        return;
      }
      const { carousel, pack } = found;
      const grid = findPullsGrid(carousel.root);
      if (grid?.slots.length === pack.cards.length) {
        // Sous la carte, la place se règle en CSS (`ACTION_START`) : l'ordre d'arrivée des boutons n'y change rien.
        for (const { actions, index } of grid.slots) {
          slots.render(actions, render({ pack, index, inGrid: true }), { parent: actions, inline: true, className: start ? ACTION_START : undefined });
        }
        const parents = new Set(grid.slots.map((slot) => slot.actions));
        slots.prune((parent) => parents.has(parent));
        return;
      }
      const placement: Placement = start
        ? { parent: carousel.nav, after: carousel.dotsBox, inline: true }
        : { parent: carousel.nav, before: carousel.next, inline: true };
      slots.render(carousel.nav, render({ pack, index: carousel.index, inGrid: false }), placement);
      slots.prune((parent) => parent === carousel.nav);
    },
  };
}

/** Prévient de tout ce qui change l'état des boutons d'action : paquet, mises en vente, verrou du carrousel, grille. */
export function onPackActionsChange(listener: () => void, options: { readonly signal: AbortSignal }): void {
  onPackChange(listener, options);
  onListingsChange(listener, options);
  onCarouselLockChange(listener, options);
  onPullsGridChange(listener, options);
}
