import { h } from 'preact';
import { sleep } from '@/core/async';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { onSettingsChange } from '@/core/settings';
import { normalizeText } from '@/core/text';
import { markModalCard } from '@/services/card-marks';
import { listingOf, trackListings } from '@/services/listings';
import { findPullsGrid } from '@/services/pulls-grid';
import {
  carouselLock,
  clickThrough,
  currentPack,
  injectCarouselStyle,
  lockCarousel,
  markBusy,
  markDiscarded,
  onPackActionsChange,
  packActions,
  packCarousel,
  trackPack,
  unlockCarousel,
  type OpenPack,
} from '@/services/pulls-pack';
import { quickDiscardProtection, type CardFacts } from '@/services/quick-discard';
import { discardUserCard, siteErrorText } from '@/site/api';
import { findCardModals } from '@/site/cards';
import { findCarousel, type Carousel, type PackCard } from '@/site/pulls';
import { PULLS_ROUTE } from '@/site/routes';
import { unlockAll } from '@/ui/lock';
import { STAMPS, syncStamps, unstampAll, type Stamp } from '@/ui/stamp';
import { toast } from '@/ui/toast';
import { DiscardButton, type DiscardStatus } from './DiscardButton';
import { settings } from './settings';

/** Propriétaire de nos verrous (contrôles du site, carrousel, cartes du paquet) et de nos tampons. */
const OWNER = 'pulls-discard-next';
const DISCARDING = 'Défausse en cours…';

function facts(state: OpenPack, card: PackCard): CardFacts {
  const copies = [...(state.copies?.values() ?? [])].filter((copy) => copy.cardId === card.id);
  return { starred: copies.some((copy) => copy.starred), tagged: copies.some((copy) => copy.tags > 0) };
}

const sameTitle = (a: string | undefined, b: string | undefined) => normalizeText(a) === normalizeText(b);

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

    if (!(await ctx.ready())) return;
    injectCarouselStyle();

    function currentFacts(state: OpenPack, index: number): { status: DiscardStatus; reason?: string } {
      const busy = state.busy.get(index);
      if (busy) return busy.owner === OWNER ? { status: 'busy' } : { status: 'blocked', reason: busy.label };
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

    // Carrousel : passe ensuite à la suivante ; grille : sous chaque carte, sans passage.
    const actions = packActions(
      ({ pack, index, inGrid }) =>
        h(DiscardButton, {
          advance: !inGrid,
          ...currentFacts(pack, index),
          onClick: () => void (inGrid ? discardInGrid(index) : discardCurrent()),
        }),
      { place: 'end', signal },
    );

    /** Faces défaussées affichées : copies de la grille, ou carte du carrousel. */
    function discardedFaces(carousel: Carousel, state: OpenPack): [HTMLElement, Stamp][] {
      const grid = findPullsGrid(carousel.root);
      const shown =
        grid?.slots.length === state.cards.length
          ? grid.slots.map((slot) => ({ index: slot.index, face: slot.face, title: slot.title }))
          : [{ index: carousel.index, face: carousel.face, title: carousel.title }];
      // Le titre affiché peut encore être celui de la carte précédente pendant l'animation du carrousel.
      return shown.flatMap(({ index, face, title }) =>
        face && state.discarded.has(index) && sameTitle(title, state.cards[index]?.title) ? [[face, STAMPS.discarded]] : [],
      );
    }

    /** Remet la page comme elle doit être : boutons en place, tampons, verrous. Idempotent. */
    function sync(): void {
      if (signal.aborted) return;
      const state = currentPack();
      const discardedTitles = new Set([...(state?.discarded ?? [])].map((index) => normalizeText(state?.cards[index]?.title)).filter(Boolean));
      for (const modal of findCardModals()) markModalCard(modal, OWNER, discardedTitles.has(normalizeText(modal.title)) ? 'discarded' : undefined);
      actions.sync();
      const found = packCarousel();
      if (found) syncStamps(OWNER, discardedFaces(found.carousel, found.pack), found.carousel.root);
    }

    /**
     * Exemplaire à défausser pour la carte `index`, affichée sous le titre `shown` ; `undefined` (et un
     * toast si la carte ne correspond pas) quand rien ne doit partir.
     */
    function target(state: OpenPack, index: number, shown: string | undefined): string | undefined {
      const card = state.cards[index];
      if (!card || currentFacts(state, index).status !== 'ready') return undefined;
      if (!sameTitle(shown, card.title)) {
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
        toast.error(`« ${title} » : ${siteErrorText(error)}`, { title: 'Défausse impossible' });
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
      if (!userCardId || !lockCarousel(OWNER, DISCARDING)) return;

      markBusy(state, index, OWNER, DISCARDING);
      try {
        if (!(await request(state, index, userCardId)) || signal.aborted) return;
        // Le temps de voir la carte défaussée, carrousel toujours verrouillé.
        await sleep(settings.get('delayMs'), signal);
        if (signal.aborted) return;
        const after = findCarousel();
        if (after && after.index === index && index < after.dots.length - 1 && !after.next.disabled) clickThrough(after.next);
      } finally {
        markBusy(state, index, OWNER, undefined);
        unlockCarousel(OWNER);
      }
    }

    async function discardInGrid(index: number): Promise<void> {
      const state = currentPack();
      const slot = findPullsGrid()?.slots[index];
      if (!state || !slot?.arrived) return;
      const userCardId = target(state, index, slot.title);
      if (!userCardId) return;
      markBusy(state, index, OWNER, DISCARDING);
      try {
        await request(state, index, userCardId);
      } finally {
        markBusy(state, index, OWNER, undefined);
      }
    }

    watchDom(sync, { signal });
    onSettingsChange(sync, { signal });
    onPackActionsChange(sync, { signal });
    ctx.onDispose(() => {
      unstampAll(OWNER);
      unlockCarousel(OWNER);
      unlockAll(OWNER);
    });
  },
};
