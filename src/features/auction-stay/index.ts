import { watchDom, whenBody } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { isTitleListed, onListingsChange, trackListings } from '@/services/listings';
import { findPullsGrid, onPullsGridChange } from '@/services/pulls-grid';
import { findCardModals, readAuctionCreation } from '@/site/cards';
import { findCarousel } from '@/site/pulls';
import { ensureRouterGuards, guardRouterPush, navigateTo } from '@/site/router';
import { lockControl, unlockAll } from '@/ui/lock';
import { stampedFaces, stampFace, unstampAll, type Stamp } from '@/ui/stamp';
import { toast } from '@/ui/toast';

const OWNER = 'auction-stay';
const LISTED = 'Carte mise aux enchères';
const ON_SALE: Stamp = { label: 'En vente', tone: 'success' };
/** Au-delà, une redirection vers une annonce n'est plus considérée comme la suite de la mise en vente. */
const REDIRECT_WINDOW_MS = 30_000;
const AUCTION_PAGE = /^\/marketplace\/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})$/i;

const normalize = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

export const auctionStay: Feature = {
  id: 'auction-stay',
  name: 'Mise aux enchères',
  toggleLabel: 'Rester sur la carte après la mise aux enchères',
  description: "Pas de redirection vers l'enchère : une notification confirme la publication, avec un lien vers l'enchère.",
  category: 'Enchères',
  routes: 'all',
  async mount(ctx) {
    const { signal, log } = ctx;
    trackListings();
    /** Mise en vente en cours : carte de la modale ouverte au moment de « Lancer l'enchère ». */
    let pending: { at: number; title: string } | undefined;

    // Le site crée l'enchère, ferme sa modale d'enchère (retour à la modale de la carte), puis appelle
    // router.push('/marketplace/<id>') : c'est cette redirection qu'on retient.
    net.intercept(
      (request) => readAuctionCreation(request) !== undefined && !request.own,
      () => {
        const modal = findCardModals().find((m) => m.auctionButton);
        pending = { at: Date.now(), title: normalize(modal?.title) };
        // La redirection suit la réponse : le routeur doit être intercepté avant (sans attendre la recherche périodique).
        ensureRouterGuards();
        return undefined;
      },
      { signal },
    );
    net.observe(
      (request) => readAuctionCreation(request) !== undefined,
      (exchange) => {
        if (!exchange.ok) pending = undefined;
      },
      { signal },
    );

    guardRouterPush(
      (href) => {
        const path = new URL(href, location.href).pathname;
        if (!AUCTION_PAGE.test(path) || !pending || Date.now() - pending.at > REDIRECT_WINDOW_MS) return false;
        const { title } = pending;
        pending = undefined;
        log.debug('redirection évitée', path);
        toast.success(title ? `« ${title} » est aux enchères.` : 'La carte est aux enchères.', {
          title: 'Enchère publiée',
          action: { label: "Voir l'enchère", onClick: () => navigateTo(path) },
        });
        return true;
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;

    // Carte aux enchères : exemplaire réservé par le site, plus de vente, de défausse ni d'étiquette.
    function sync(): void {
      for (const modal of findCardModals()) {
        // Vue catalogue : la carte (modèle), pas un exemplaire, elle n'est jamais « en vente ».
        if (modal.catalog) continue;
        const listed = isTitleListed(modal.title);
        for (const control of [modal.auctionButton, modal.discardButton, modal.tagInput]) {
          if (control) lockControl(control, { owner: OWNER, locked: listed, reason: LISTED });
        }
        if (modal.face) stampFace(modal.face, OWNER, listed ? { ...ON_SALE, revealable: true } : undefined);
      }
      const carousel = findCarousel();
      if (!carousel) return;
      // Toutes les cartes d'un coup : les copies de la grille ; sinon la carte du carrousel.
      const grid = findPullsGrid(carousel.root);
      const faces = grid
        ? grid.slots.flatMap((slot) => (slot.face ? [{ face: slot.face, title: slot.title }] : []))
        : carousel.face
          ? [{ face: carousel.face, title: carousel.title }]
          : [];
      const wanted = faces.filter(({ title }) => isTitleListed(title)).map(({ face }) => face);
      for (const stamped of stampedFaces(OWNER, carousel.root)) {
        if (!wanted.includes(stamped)) stampFace(stamped, OWNER, undefined);
      }
      for (const face of wanted) stampFace(face, OWNER, ON_SALE);
    }
    watchDom(sync, { signal });
    onListingsChange(sync, { signal });
    // Ce qui se passe dans la grille (copie de face remplacée) échappe à watchDom.
    onPullsGridChange(sync, { signal });
    ctx.onDispose(() => {
      unlockAll(OWNER);
      unstampAll(OWNER);
    });
  },
};
