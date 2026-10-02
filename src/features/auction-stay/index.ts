import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import { matchRoute } from '@/core/router';
import type { Feature } from '@/core/runtime';
import { markModalCard } from '@/services/card-marks';
import { listedCardTitle, listingOf, onListingsChange, trackListings } from '@/services/listings';
import { notify } from '@/services/notifications';
import { findPullsGrid, onPullsGridChange } from '@/services/pulls-grid';
import { onPackChange, packCarousel, trackPack, type OpenPack } from '@/services/pulls-pack';
import { readAuctionCreation } from '@/site/api';
import { findCardModals, readModalView, type CardModal } from '@/site/cards';
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

/** La carte `index` du paquet : l'exemplaire que le site y associe est-il aux enchères ? */
function isPackCardListed(pack: OpenPack | undefined, index: number): boolean {
  const card = pack?.cards[index];
  const copy = card && pack?.chosen?.get(card.id);
  return copy !== undefined && listingOf(copy) !== undefined;
}

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
    trackPack();
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

    // Exemplaire de chaque modale, lu une fois (parcours de l'arbre de React) tant que sa carte ne change pas.
    const modalCopies = new WeakMap<HTMLElement, { readonly title: string; readonly copy: string | undefined }>();
    function copyOf(modal: CardModal): string | undefined {
      const known = modalCopies.get(modal.root);
      if (known?.title === modal.title) return known.copy;
      const copy = readModalView(modal.root)?.userCardId;
      modalCopies.set(modal.root, { title: modal.title, copy });
      return copy;
    }

    // Exemplaire aux enchères : réservé par le site, plus de vente, de défausse ni d'étiquette. Reconnu à son
    // identifiant, pas au titre : un autre exemplaire de la carte, ou celui revenu d'une enchère invendue, reste libre.
    function sync(): void {
      for (const modal of findCardModals()) {
        // Carte seule (modèle) ou exemplaire d'un ami : jamais un de mes exemplaires « en vente ».
        if (modal.kind !== 'own') continue;
        const copy = copyOf(modal);
        markModalCard(modal, OWNER, copy !== undefined && listingOf(copy) ? 'listed' : undefined);
      }
      const carousel = findCarousel();
      if (!carousel) return;
      const pack = packCarousel()?.pack;
      // Toutes les cartes d'un coup : les copies de la grille ; sinon la carte du carrousel.
      const faces = findPullsGrid(carousel.root)?.slots ?? [{ face: carousel.face, index: carousel.index }];
      syncStamps(
        OWNER,
        faces.flatMap(({ face, index }) => (face && isPackCardListed(pack, index) ? [[face, STAMPS.listed] as const] : [])),
        carousel.root,
      );
    }
    watchDom(sync, { signal });
    onListingsChange(sync, { signal });
    // Exemplaires du paquet chargés après lui (paquet PRO).
    onPackChange(sync, { signal });
    // Ce qui se passe dans la grille (copie de face remplacée) échappe à watchDom.
    onPullsGridChange(sync, { signal });
    ctx.onDispose(() => {
      unlockAll(OWNER);
      unstampAll(OWNER);
    });
  },
};
