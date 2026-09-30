import { h, type ComponentChild } from 'preact';
import { childController, sleep } from '@/core/async';
import { injectStyle, watchDom, whenBody } from '@/core/dom';
import { errorMessage } from '@/core/log';
import type { Feature } from '@/core/runtime';
import { onSettingsChange } from '@/core/settings';
import { listingOf, onListingsChange, trackListings } from '@/services/listings';
import { findPullsGrid, onPullsGridChange, type PullsGrid } from '@/services/pulls-grid';
import {
  carouselLock,
  clickThrough,
  injectCarouselStyle,
  currentPack,
  lockCarousel,
  markDiscarded,
  markDiscarding,
  onCarouselLockChange,
  onPackChange,
  packCarousel,
  trackPack,
  unlockCarousel,
  type OpenPack,
} from '@/services/pulls-pack';
import { quickDiscardProtection, type CardFacts } from '@/services/quick-discard';
import { discardUserCard } from '@/site/api';
import { findCardModals } from '@/site/cards';
import { findCarousel, PULLS_ROUTE, type Carousel, type PackCard } from '@/site/pulls';
import { lockControl, unlockAll } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { stampedFaces, stampFace, unstampAll, type Stamp } from '@/ui/stamp';
import { toast } from '@/ui/toast';
import { DiscardButton, type DiscardStatus } from './DiscardButton';
import { settings } from './settings';
import { CSS } from './style';

/** Un de nos boutons, dans son conteneur : rangée du carrousel, ou dessous d'une carte de la grille. */
interface Placed {
  readonly ui: MountedUi;
  readonly controller: AbortController;
}

/** Propriétaire de nos verrous sur les contrôles du site et sur le carrousel. */
const OWNER = 'pulls-discard-next';

const DISCARDED: Stamp = { label: 'Défaussée', tone: 'danger' };

const normalize = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

function facts(state: OpenPack, card: PackCard): CardFacts {
  const copies = [...(state.copies?.values() ?? [])].filter((copy) => copy.cardId === card.id);
  return { starred: copies.some((copy) => copy.starred), tagged: copies.some((copy) => copy.tags > 0) };
}

export const pullsDiscardNext: Feature = {
  id: 'pulls-discard-next',
  name: 'Défaussage rapide',
  toggleLabel: 'Afficher le bouton',
  description: "Un bouton défausse la carte d'un clic. Dans le carrousel, il passe ensuite à la suivante.",
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  settings,
  async mount(ctx) {
    const { signal, log } = ctx;
    trackListings();
    trackPack();
    const placed = new Map<HTMLElement, Placed>();

    await whenBody();
    if (signal.aborted) return;
    injectStyle('pulls-discard', CSS);
    injectCarouselStyle();

    function currentFacts(state: OpenPack, index: number): { status: DiscardStatus; reason?: string } {
      if (state.discarding.has(index)) return { status: 'busy' };
      const lock = carouselLock();
      // Une autre action tient la carte affichée (ouverture de la mise aux enchères) : rien ne part d'ici là.
      if (lock && lock.owner !== OWNER) return { status: 'blocked', reason: lock.label };
      if (state.discarded.has(index)) return { status: 'discarded' };
      const card = state.cards[index];
      if (!card) return { status: 'unavailable' };
      const copy = state.chosen?.get(card.id);
      if (copy && listingOf(copy)) return { status: 'listed' };
      const reason = quickDiscardProtection(facts(state, card));
      if (reason) return { status: 'protected', reason };
      return { status: state.chosen?.has(card.id) ? 'ready' : 'unavailable' };
    }

    /** Pose (ou redessine) notre bouton dans `parent`, avant `before`. */
    function place(parent: HTMLElement, before: Element | null, vnode: ComponentChild): void {
      const current = placed.get(parent);
      if (current?.ui.element.parentElement === parent && current.ui.element.nextElementSibling === before) {
        current.ui.update(vnode);
        return;
      }
      current?.controller.abort();
      const controller = childController(signal);
      placed.set(parent, { ui: mountUi(vnode, { parent, before, inline: true, signal: controller.signal }), controller });
    }

    /** Retire nos boutons hors de `keep`. */
    function prune(keep: readonly HTMLElement[]): void {
      for (const [parent, current] of placed) {
        if (keep.includes(parent)) continue;
        current.controller.abort();
        placed.delete(parent);
      }
    }

    /** Tampon « Défaussée » sur les faces de `wanted`, retiré des autres. */
    function syncMarks(root: HTMLElement, wanted: readonly HTMLElement[]): void {
      for (const stamped of stampedFaces(OWNER, root)) {
        if (!wanted.includes(stamped)) stampFace(stamped, OWNER, undefined);
      }
      for (const face of wanted) stampFace(face, OWNER, DISCARDED);
    }

    function syncCarousel(carousel: Carousel, state: OpenPack): void {
      const button = h(DiscardButton, {
        advance: true,
        ...currentFacts(state, carousel.index),
        onClick: () => void discardCurrent(),
      });
      place(carousel.nav, carousel.next, button);
      prune([carousel.nav]);
      const card = state.cards[carousel.index];
      const face = carousel.face;
      // Le titre affiché peut encore être celui de la carte précédente pendant l'animation du carrousel.
      const shown = face && card && state.discarded.has(carousel.index) && normalize(carousel.title) === normalize(card.title);
      syncMarks(carousel.root, shown ? [face] : []);
    }

    /** Grille « toutes les cartes d'un coup » : un bouton sous chaque carte, sans passage à la suivante. */
    function syncGrid(grid: PullsGrid, carousel: Carousel, state: OpenPack): void {
      for (const slot of grid.slots) {
        const button = h(DiscardButton, {
          advance: false,
          ...currentFacts(state, slot.index),
          onClick: () => void discardInGrid(slot.index),
        });
        place(slot.actions, null, button);
      }
      prune(grid.slots.map((slot) => slot.actions));
      const marked = grid.slots.flatMap((slot) =>
        slot.face && state.discarded.has(slot.index) && normalize(slot.title) === normalize(state.cards[slot.index]?.title)
          ? [slot.face]
          : [],
      );
      syncMarks(carousel.root, marked);
    }

    function syncModals(state: OpenPack | undefined): void {
      const discardedTitles = new Set(
        [...(state?.discarded ?? [])].map((index) => normalize(state?.cards[index]?.title)).filter(Boolean),
      );
      for (const modal of findCardModals()) {
        const locked = discardedTitles.has(normalize(modal.title));
        for (const control of [modal.discardButton, modal.auctionButton, modal.tagInput]) {
          if (control) lockControl(control, { owner: OWNER, locked, reason: 'Carte déjà défaussée' });
        }
        if (modal.face) stampFace(modal.face, OWNER, locked ? { ...DISCARDED, revealable: true } : undefined);
      }
    }

    /** Remet la page comme elle doit être : boutons en place, marques, verrous. Idempotent. */
    function sync(): void {
      if (signal.aborted) return;
      syncModals(currentPack());
      const found = packCarousel();
      if (!found) {
        prune([]);
        return;
      }
      const { carousel, pack: state } = found;
      const grid = findPullsGrid(carousel.root);
      if (grid?.slots.length === state.cards.length) syncGrid(grid, carousel, state);
      else syncCarousel(carousel, state);
    }

    /**
     * Exemplaire à défausser pour la carte `index`, affichée sous le titre `shown` ; `undefined` (et un
     * toast si la carte ne correspond pas) quand rien ne doit partir.
     */
    function target(state: OpenPack, index: number, shown: string | undefined): string | undefined {
      const card = state.cards[index];
      if (!card || currentFacts(state, index).status !== 'ready') return undefined;
      if (normalize(shown) !== normalize(card.title)) {
        log.warn('carte affichée différente de la carte attendue', { affichée: shown, attendue: card.title });
        toast.error("La carte affichée n'a pas été reconnue : rien n'a été défaussé.", { title: 'Défausse annulée' });
        return undefined;
      }
      const userCardId = state.chosen?.get(card.id);
      if (!userCardId) {
        toast.error(`Exemplaire de « ${card.title} » introuvable : rien n'a été défaussé.`, { title: 'Défausse impossible' });
      }
      return userCardId;
    }

    /** Une seule tentative ; refus du site en toast. Vrai si la carte est défaussée. */
    async function request(state: OpenPack, index: number, userCardId: string): Promise<boolean> {
      const title = state.cards[index]?.title ?? '';
      try {
        await discardUserCard(userCardId);
      } catch (error) {
        log.warn('défausse refusée', title, error);
        toast.error(`« ${title} » : ${errorMessage(error)}`, { title: 'Défausse impossible' });
        return false;
      }
      markDiscarded(userCardId);
      log.debug('défaussée', title);
      return true;
    }

    async function discardCurrent(): Promise<void> {
      const found = packCarousel();
      if (!found || found.carousel.index < 0) return;
      const { carousel, pack: state } = found;
      const index = carousel.index;
      const userCardId = target(state, index, carousel.title);
      if (!userCardId || !lockCarousel(OWNER, 'Défausse en cours…')) return;

      markDiscarding(state, index, true);
      sync();
      try {
        if (!(await request(state, index, userCardId)) || signal.aborted) return;
        sync();
        // Le temps de voir la carte défaussée, carrousel toujours verrouillé.
        await sleep(settings.get('delayMs'), signal);
        if (signal.aborted) return;
        const after = findCarousel();
        if (after && after.index === index && index < after.dots.length - 1 && !after.next.disabled) clickThrough(after.next);
      } finally {
        markDiscarding(state, index, false);
        unlockCarousel(OWNER);
        sync();
      }
    }

    async function discardInGrid(index: number): Promise<void> {
      const state = currentPack();
      const slot = findPullsGrid()?.slots[index];
      if (!state || !slot?.arrived) return;
      const userCardId = target(state, index, slot.title);
      if (!userCardId) return;
      markDiscarding(state, index, true);
      sync();
      try {
        await request(state, index, userCardId);
      } finally {
        markDiscarding(state, index, false);
        sync();
      }
    }

    watchDom(sync, { signal });
    onSettingsChange(sync, { signal });
    onListingsChange(sync, { signal });
    onPullsGridChange(sync, { signal });
    onPackChange(sync, { signal });
    onCarouselLockChange(sync, { signal });
    ctx.onDispose(() => {
      prune([]);
      unstampAll(OWNER);
      unlockCarousel(OWNER);
      unlockAll(OWNER);
    });
  },
};
