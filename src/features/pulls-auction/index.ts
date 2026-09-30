import { h, type ComponentChild } from 'preact';
import { childController, sleep } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { listingOf, onListingsChange, trackListings } from '@/services/listings';
import { findPullsGrid, onPullsGridChange, type PullsGrid } from '@/services/pulls-grid';
import {
  carouselLock,
  clickThrough,
  injectCarouselStyle,
  lockCarousel,
  onCarouselLockChange,
  onPackChange,
  packCarousel,
  trackPack,
  unlockCarousel,
  type OpenPack,
} from '@/services/pulls-pack';
import { findAuctionModal, findCardModals, isSiteModalOpen, type CardModal } from '@/site/cards';
import { PULLS_ROUTE, type Carousel } from '@/site/pulls';
import { mountUi, type MountedUi } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { AuctionButton, type AuctionStatus } from './AuctionButton';
import { CSS, HOST_HIDDEN } from './style';

/** Propriétaire du verrou du carrousel. */
const OWNER = 'pulls-auction';
const OPENING_LABEL = 'Ouverture de la mise aux enchères…';
/**
 * Nouveau clic sur la carte si sa modale n'est pas ouverte : le site ignore le premier clic qui suit un
 * glissement, la grille ceux qui arrivent avant la fin de l'arrivée des cartes.
 */
const RETRY_CLICK_MS = 500;
const CARD_TIMEOUT_MS = 3000;
/** La modale d'enchère du site se charge à sa première ouverture, et le site peut être lent. */
const AUCTION_TIMEOUT_MS = 20_000;

/**
 * - `card` : clic sur la carte, en attente de la modale de carte ;
 * - `auction` : clic sur son « Mettre aux enchères », en attente de la modale d'enchère ;
 * - `open` : mise en vente affichée ; quand elle se ferme (annulée ou publiée), la modale de carte aussi.
 */
type Phase = 'card' | 'auction' | 'open';

interface Opening {
  readonly title: string;
  /** Position de la carte dans le paquet. */
  readonly index: number;
  /** Lancée depuis la grille : c'est elle qui ouvre la carte (clic sur sa copie). */
  readonly fromGrid: boolean;
  phase: Phase;
  /** Modale de carte ouverte pour l'occasion, cachée jusqu'au bout. */
  modal: HTMLElement | undefined;
  /** Minuteries de cette ouverture. */
  readonly controller: AbortController;
}

/** Notre bouton, dans son conteneur : rangée du carrousel, ou dessous d'une carte de la grille. */
interface Placed {
  readonly ui: MountedUi;
  readonly controller: AbortController;
}

const normalize = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/**
 * Le site ne met en vente que depuis la modale de carte : on la fait ouvrir, cachée (clic sur la carte du
 * carrousel, ou sur sa copie dans la grille, qui fait passer le carrousel caché dessus), puis on clique son
 * « Mettre aux enchères ». La mise en vente (modale du site, présentée par auction-modal) reste celle du
 * site ; à sa fermeture, on referme la modale de carte.
 */
export const pullsAuction: Feature = {
  id: 'pulls-auction',
  name: 'Enchère rapide',
  toggleLabel: 'Afficher le bouton',
  description: "Un bouton ouvre d'un clic la mise aux enchères de la carte.",
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  async mount(ctx) {
    const { signal, log } = ctx;
    trackListings();
    trackPack();
    let opening: Opening | undefined;
    const placed = new Map<HTMLElement, Placed>();

    await whenBody();
    if (signal.aborted) return;
    injectStyle('pulls-auction', CSS);
    injectCarouselStyle();

    function status(pack: OpenPack, index: number): { status: AuctionStatus; reason?: string } {
      if (opening) return opening.index === index ? { status: 'busy' } : { status: 'blocked', reason: OPENING_LABEL };
      const lock = carouselLock();
      if (lock) return { status: 'blocked', reason: lock.label };
      if (pack.discarding.has(index)) return { status: 'blocked', reason: 'Défausse en cours…' };
      if (pack.discarded.has(index)) return { status: 'discarded' };
      const card = pack.cards[index];
      const copy = card && pack.chosen?.get(card.id);
      if (!copy) return { status: 'unavailable' };
      if (listingOf(copy)) return { status: 'listed' };
      return { status: 'ready' };
    }

    function hostOf(current: Opening): CardModal | undefined {
      const modals = findCardModals();
      if (current.modal) return modals.find((modal) => modal.root === current.modal);
      return modals.find((modal) => normalize(modal.title) === current.title);
    }

    /** Clic sur la carte `current.index` : celle du carrousel, ou sa copie dans la grille. */
    function clickCard(current: Opening): void {
      const carousel = packCarousel()?.carousel;
      if (!carousel) return;
      if (current.fromGrid) findPullsGrid(carousel.root)?.slots[current.index]?.face?.click();
      else if (carousel.face && carousel.index === current.index) clickThrough(carousel.face);
    }

    function later(current: Opening, ms: number, phase: Phase, action: () => void): void {
      void sleep(ms, current.controller.signal).then(() => {
        if (opening === current && current.phase === phase && !current.controller.signal.aborted) action();
      });
    }

    function finish(current: Opening): void {
      if (opening !== current) return;
      opening = undefined;
      current.controller.abort();
      if (current.modal?.isConnected) setClass(current.modal, HOST_HIDDEN, false);
      unlockCarousel(OWNER);
      sync();
    }

    function fail(current: Opening, reason: string): void {
      if (opening !== current) return;
      log.warn('enchère rapide abandonnée', current.title, reason);
      if (current.modal) hostOf(current)?.closeButton?.click();
      finish(current);
      toast.error(`« ${current.title} » : ${reason}`, { title: 'Mise aux enchères impossible' });
    }

    /** Clique la carte jusqu'à ce que sa modale s'ouvre, dans la limite du délai. */
    async function openCard(current: Opening): Promise<void> {
      const deadline = performance.now() + CARD_TIMEOUT_MS;
      clickCard(current);
      while (performance.now() < deadline) {
        await sleep(RETRY_CLICK_MS, current.controller.signal);
        if (opening !== current || current.phase !== 'card' || current.controller.signal.aborted) return;
        if (!hostOf(current)) clickCard(current);
      }
      if (opening === current && current.phase === 'card') {
        fail(current, hostOf(current) ? 'cette carte ne peut pas être mise aux enchères.' : "la carte ne s'est pas ouverte.");
      }
    }

    function start(index: number, fromGrid: boolean): void {
      const found = packCarousel();
      if (opening || !found || isSiteModalOpen()) return;
      const { carousel, pack } = found;
      const card = pack.cards[index];
      if (!card || status(pack, index).status !== 'ready') return;
      if (fromGrid ? !findPullsGrid(carousel.root)?.slots[index]?.arrived : carousel.index !== index) return;
      const current: Opening = {
        title: normalize(card.title),
        index,
        fromGrid,
        phase: 'card',
        modal: undefined,
        controller: childController(signal),
      };
      opening = current;
      // Dans la grille, le verrou attend la modale de carte : la grille ne fait pas passer le carrousel sur
      // la carte tant qu'une action le tient.
      if (!fromGrid && !lockCarousel(OWNER, OPENING_LABEL)) {
        opening = undefined;
        current.controller.abort();
        return;
      }
      log.debug('ouverture de la mise aux enchères', card.title);
      void openCard(current);
      sync();
    }

    /** Fait avancer l'ouverture en cours d'après ce que montre la page. */
    function syncOpening(): void {
      const current = opening;
      if (!current) return;
      const host = hostOf(current);
      if (!host) {
        // Modale de carte fermée par le site (Échap, navigation) : plus rien à faire.
        if (current.modal) finish(current);
        return;
      }
      current.modal = host.root;
      setClass(host.root, HOST_HIDDEN, true);

      if (current.phase === 'card') {
        const sell = host.auctionButton;
        // Pas encore de bouton : l'échéance tranchera.
        if (!sell) return;
        if (sell.disabled) {
          // Désactivé par le site (limite d'enchères actives) ou par une fonctionnalité : son info-bulle dit pourquoi.
          fail(current, sell.title || 'cette carte ne peut pas être mise aux enchères.');
          return;
        }
        // Étape avancée avant le verrou : le poser prévient ses abonnés, dont nous (un second clic sinon).
        current.phase = 'auction';
        if (!lockCarousel(OWNER, OPENING_LABEL)) {
          fail(current, 'une autre action est en cours sur la carte.');
          return;
        }
        later(current, AUCTION_TIMEOUT_MS, 'auction', () => fail(current, "la mise aux enchères ne s'est pas ouverte."));
        sell.click();
        return;
      }
      const auction = findAuctionModal();
      if (current.phase === 'auction') {
        if (auction) current.phase = 'open';
        return;
      }
      if (!auction) {
        host.closeButton?.click();
        finish(current);
      }
    }

    /** Pose (ou redessine) notre bouton dans `parent`, juste après `after` (en tête sans lui) : à gauche de la corbeille. */
    function place(parent: HTMLElement, after: Element | null, vnode: ComponentChild): void {
      const current = placed.get(parent);
      const element = current?.ui.element;
      if (current && element?.parentElement === parent && element.previousElementSibling === after) {
        current.ui.update(vnode);
        return;
      }
      current?.controller.abort();
      const controller = childController(signal);
      const before = after ? after.nextSibling : parent.firstChild;
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

    function button(carousel: Carousel, pack: OpenPack, index: number, fromGrid: boolean) {
      return h(AuctionButton, {
        ...status(pack, index),
        onClick: () => start(index, fromGrid),
      });
    }

    function syncGrid(grid: PullsGrid, carousel: Carousel, pack: OpenPack): void {
      for (const slot of grid.slots) place(slot.actions, null, button(carousel, pack, slot.index, true));
      prune(grid.slots.map((slot) => slot.actions));
    }

    /** Synchronisation en cours : les notifications qu'elle provoque (verrou, paquet) n'en relancent pas une autre. */
    let syncing = false;

    /** Remet la page comme elle doit être : ouverture en cours, boutons en place. Idempotent. */
    function sync(): void {
      if (signal.aborted || syncing) return;
      syncing = true;
      try {
        syncOpening();
        syncButtons();
      } finally {
        syncing = false;
      }
    }

    function syncButtons(): void {
      const found = packCarousel();
      if (!found) {
        prune([]);
        return;
      }
      const { carousel, pack } = found;
      const grid = findPullsGrid(carousel.root);
      if (grid?.slots.length === pack.cards.length) {
        syncGrid(grid, carousel, pack);
        return;
      }
      place(carousel.nav, carousel.dotsBox, button(carousel, pack, carousel.index, false));
      prune([carousel.nav]);
    }

    watchDom(sync, { signal });
    onPackChange(sync, { signal });
    onListingsChange(sync, { signal });
    onCarouselLockChange(sync, { signal });
    onPullsGridChange(sync, { signal });
    ctx.onDispose(() => {
      prune([]);
      opening?.controller.abort();
      opening = undefined;
      document.querySelectorAll(`.${HOST_HIDDEN}`).forEach((element) => element.classList.remove(HOST_HIDDEN));
      unlockCarousel(OWNER);
    });
  },
};
