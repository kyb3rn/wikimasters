import { h } from 'preact';
import { childController, later, sleep } from '@/core/async';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { normalizeText } from '@/core/text';
import { listingOf, trackListings } from '@/services/listings';
import { findPullsGrid } from '@/services/pulls-grid';
import {
  carouselLock,
  clickThrough,
  injectCarouselStyle,
  lockCarousel,
  markBusy,
  onPackActionsChange,
  packActions,
  packCarousel,
  trackPack,
  unlockCarousel,
  type OpenPack,
} from '@/services/pulls-pack';
import { findAuctionModal, findCardModals, type CardModal } from '@/site/cards';
import { isSiteModalOpen } from '@/site/modals';
import { PULLS_ROUTE } from '@/site/routes';
import { toast } from '@/ui/toast';
import { AuctionButton, type AuctionStatus } from './AuctionButton';

/** Propriétaire du verrou du carrousel et de la carte occupée. */
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
/** Modale de carte ouverte par l'enchère rapide : cachée (mais affichée), seule la mise en vente se voit. */
const HOST_HIDDEN = 'wm-quick-auction-host';

/**
 * - `card` : clic sur la carte, en attente de la modale de carte ;
 * - `auction` : clic sur son « Mettre aux enchères », en attente de la modale d'enchère ;
 * - `open` : mise en vente affichée ; quand elle se ferme (annulée ou publiée), la modale de carte aussi.
 */
type Phase = 'card' | 'auction' | 'open';

interface Opening {
  readonly title: string;
  readonly pack: OpenPack;
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

    if (!(await ctx.ready())) return;
    injectCarouselStyle();
    ctx.style(`.${HOST_HIDDEN} { visibility: hidden !important; pointer-events: none !important; }`);
    const marks = classMarks(signal);

    function status(pack: OpenPack, index: number): { status: AuctionStatus; reason?: string } {
      if (opening) return opening.index === index ? { status: 'busy' } : { status: 'blocked', reason: OPENING_LABEL };
      const busy = pack.busy.get(index);
      if (busy) return { status: 'blocked', reason: busy.label };
      const lock = carouselLock();
      if (lock) return { status: 'blocked', reason: lock.label };
      if (pack.discarded.has(index)) return { status: 'discarded' };
      const card = pack.cards[index];
      const copy = card && pack.chosen?.get(card.id);
      if (!copy) return { status: 'unavailable' };
      if (listingOf(copy)) return { status: 'listed' };
      return { status: 'ready' };
    }

    // Juste à gauche de la corbeille : après les pastilles du carrousel, en tête sous une carte de la grille.
    const actions = packActions(
      ({ pack, index, inGrid }) => h(AuctionButton, { ...status(pack, index), onClick: () => start(index, inGrid) }),
      { place: 'start', signal },
    );

    function hostOf(current: Opening): CardModal | undefined {
      const modals = findCardModals();
      if (current.modal) return modals.find((modal) => modal.root === current.modal);
      return modals.find((modal) => normalizeText(modal.title) === current.title);
    }

    /** Clic sur la carte `current.index` : celle du carrousel, ou sa copie dans la grille. */
    function clickCard(current: Opening): void {
      const carousel = packCarousel()?.carousel;
      if (!carousel) return;
      if (current.fromGrid) findPullsGrid(carousel.root)?.slots[current.index]?.face?.click();
      else if (carousel.face && carousel.index === current.index) clickThrough(carousel.face);
    }

    function finish(current: Opening): void {
      if (opening !== current) return;
      opening = undefined;
      current.controller.abort();
      if (current.modal) marks.set(current.modal, HOST_HIDDEN, false);
      markBusy(current.pack, current.index, OWNER, undefined);
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
        title: normalizeText(card.title),
        pack,
        index,
        fromGrid,
        phase: 'card',
        modal: undefined,
        controller: childController(signal),
      };
      opening = current;
      // Dans la grille, le verrou attend la modale de carte : la grille ne fait pas passer le carrousel sur
      // la carte tant qu'une action le tient. La carte, elle, est occupée tout de suite (sa corbeille attend).
      if (!fromGrid && !lockCarousel(OWNER, OPENING_LABEL)) {
        opening = undefined;
        current.controller.abort();
        return;
      }
      markBusy(pack, index, OWNER, OPENING_LABEL);
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
      marks.set(host.root, HOST_HIDDEN, true);

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
        later(
          () => {
            if (opening === current && current.phase === 'auction') fail(current, "la mise aux enchères ne s'est pas ouverte.");
          },
          AUCTION_TIMEOUT_MS,
          current.controller.signal,
        );
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

    /** Synchronisation en cours : les notifications qu'elle provoque (verrou, paquet) n'en relancent pas une autre. */
    let syncing = false;

    /** Remet la page comme elle doit être : ouverture en cours, boutons en place. Idempotent. */
    function sync(): void {
      if (signal.aborted || syncing) return;
      syncing = true;
      try {
        syncOpening();
        actions.sync();
      } finally {
        syncing = false;
      }
    }

    watchDom(sync, { signal });
    onPackActionsChange(sync, { signal });
    ctx.onDispose(() => {
      if (opening) markBusy(opening.pack, opening.index, OWNER, undefined);
      opening?.controller.abort();
      opening = undefined;
      unlockCarousel(OWNER);
    });
  },
};
