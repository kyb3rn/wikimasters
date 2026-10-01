import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import { matchRoute } from '@/core/router';
import type { Feature } from '@/core/runtime';
import { markModalCard } from '@/services/card-marks';
import { isTitleListed, listedCardTitle, onListingsChange, trackListings } from '@/services/listings';
import { notify } from '@/services/notifications';
import { findPullsGrid, onPullsGridChange } from '@/services/pulls-grid';
import { readAuctionCreation } from '@/site/api';
import { findCardModals } from '@/site/cards';
import { findCarousel } from '@/site/pulls';
import { ensureRouterGuards, guardRouterPush } from '@/site/router';
import { AUCTION_ROUTE } from '@/site/routes';
import { unlockAll } from '@/ui/lock';
import { STAMPS, syncStamps, unstampAll } from '@/ui/stamp';

const OWNER = 'auction-stay';
/** Au-delà, une redirection vers une annonce n'est plus considérée comme la suite de la mise en vente. */
const REDIRECT_WINDOW_MS = 30_000;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Page d'une annonce (pas `/marketplace/mine` ni une autre page du marché). */
const isAuctionPage = (path: string) => UUID.test(matchRoute(AUCTION_ROUTE, path)?.id ?? '');

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
    // router.push('/marketplace/<id>') : c'est cette redirection qu'on retient, si l'enchère est créée.
    net.track(
      (request) => readAuctionCreation(request) !== undefined && !request.own,
      () => {
        const current = { at: Date.now(), title: listedCardTitle() };
        pending = current;
        // La redirection suit la réponse : le routeur doit être intercepté avant (sans attendre la recherche périodique).
        ensureRouterGuards();
        return (status) => {
          // Refusée, ou sans réponse du tout : aucune redirection ne suivra.
          if ((status === undefined || status >= 400) && pending === current) pending = undefined;
        };
      },
      { signal },
    );

    guardRouterPush(
      (href) => {
        const path = new URL(href, location.href).pathname;
        if (!isAuctionPage(path) || !pending || Date.now() - pending.at > REDIRECT_WINDOW_MS) return false;
        const { title } = pending;
        pending = undefined;
        log.debug('redirection évitée', path);
        notify({
          message: title ? `« ${title} » est aux enchères.` : 'La carte est aux enchères.',
          title: 'Enchère publiée',
          variant: 'success',
          href: path,
          actionLabel: "Voir l'enchère",
        });
        return true;
      },
      { signal },
    );

    if (!(await ctx.ready())) return;

    // Carte aux enchères : exemplaire réservé par le site, plus de vente, de défausse ni d'étiquette.
    function sync(): void {
      for (const modal of findCardModals()) {
        // Vue catalogue : la carte (modèle), pas un exemplaire, elle n'est jamais « en vente ».
        if (!modal.catalog) markModalCard(modal, OWNER, isTitleListed(modal.title) ? 'listed' : undefined);
      }
      const carousel = findCarousel();
      if (!carousel) return;
      // Toutes les cartes d'un coup : les copies de la grille ; sinon la carte du carrousel.
      const grid = findPullsGrid(carousel.root);
      const faces = grid
        ? grid.slots.map((slot) => ({ face: slot.face, title: slot.title }))
        : [{ face: carousel.face, title: carousel.title }];
      syncStamps(
        OWNER,
        faces.flatMap(({ face, title }) => (face && isTitleListed(title) ? [[face, STAMPS.listed] as const] : [])),
        carousel.root,
      );
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
