import { h } from 'preact';
import { renameText, watchDom } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { textOf } from '@/core/text';
import { marketNeedsPro, openMarketModal } from '@/services/market';
import { siteReportButton } from '@/services/report-button';
import { isWishlistChange, readDiscard } from '@/site/api';
import { findCardModals, findDiscardConfirm, readModalCard, type CardModal } from '@/site/cards';
import { onProStatusChange } from '@/site/pro';
import { lockControl, unlockAll } from '@/ui/lock';
import { createSlots } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { MarketButton, ModalActions } from './buttons';

const OWNER = 'card-modal-layout';
/**
 * Défausse réussie : la roue reste le temps que le site ferme la modale (ou que `card-modal-stay` la
 * garde, verrouillée), sans que le bouton redevienne actif entre-temps.
 */
const SETTLED_MS = 300;

/** Requêtes en cours, par modale de carte ouverte à leur départ. */
function pendingCounter() {
  const counts = new Map<HTMLElement, number>();
  return {
    has: (root: HTMLElement) => counts.has(root),
    add(roots: readonly HTMLElement[]) {
      for (const root of roots) counts.set(root, (counts.get(root) ?? 0) + 1);
    },
    remove(roots: readonly HTMLElement[]) {
      for (const root of roots) {
        const left = (counts.get(root) ?? 1) - 1;
        if (left > 0) counts.set(root, left);
        else counts.delete(root);
      }
    },
  };
}

export const cardModalLayout: Feature = {
  id: 'card-modal-layout',
  name: 'Modale de carte',
  description:
    "Présentation de la modale de carte : signalement sur l'image, actions Vendre · Marché (historique des ventes) · Défausser (roue pendant la défausse) ; carte seule (Toutes les cartes) ou d'un ami : Échanger · Liste de souhaits · Marché.",
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;

    const reports = createSlots<HTMLElement>(signal);
    const markets = createSlots<HTMLElement>(signal);
    /** Défausses en cours (défaussage rapide ou confirmation du site). */
    const discarding = pendingCounter();
    /** Ajouts ou retraits de la liste de souhaits en cours. */
    const wishing = pendingCounter();
    /** Modales dont l'historique des ventes se charge. */
    const opening = new Set<HTMLElement>();

    function openMarket(modal: CardModal): void {
      const card = readModalCard(modal);
      if (!card) {
        ctx.log.warn('carte de la modale introuvable dans son état React', modal.title);
        toast.error('Carte non identifiée : historique des ventes indisponible.', { title: 'Marché' });
        return;
      }
      opening.add(modal.root);
      sync();
      void openMarketModal(card).finally(() => {
        opening.delete(modal.root);
        sync();
      });
    }

    // Défausse partie de la modale, jusqu'à la réponse ou l'échec réseau.
    net.track(
      (request) => readDiscard(request) !== undefined && !request.own,
      () => {
        const roots = findCardModals().map((modal) => modal.root);
        discarding.add(roots);
        sync();
        return (status) => {
          const done = () => {
            discarding.remove(roots);
            sync();
          };
          if (status !== undefined && status < 400) setTimeout(done, SETTLED_MS);
          else done();
        };
      },
      { signal },
    );

    // Liste de souhaits : le site change son bouton tout de suite (optimiste), le nôtre attend la réponse.
    net.track(
      (request) => isWishlistChange(request) && !request.own,
      () => {
        const roots = findCardModals().map((modal) => modal.root);
        wishing.add(roots);
        sync();
        return () => {
          wishing.remove(roots);
          sync();
        };
      },
      { signal },
    );

    /** Roue et bouton désactivé sur « Défausser » (modale, et confirmation du site si elle est affichée). */
    function markDiscarding(modal: CardModal): void {
      const busy = discarding.has(modal.root);
      const confirm = findDiscardConfirm();
      const confirmButton = confirm && modal.root.contains(confirm.root) ? confirm.confirmButton : undefined;
      for (const button of [modal.discardButton, confirmButton]) {
        if (button) lockControl(button, { owner: OWNER, locked: busy, reason: 'Défausse en cours…', busy });
      }
    }

    function apply(modal: CardModal): void {
      // La rareté en toutes lettres et les onglets Détails / Marché : la rareté se voit sur la carte,
      // le marché passe dans les actions (notre historique des ventes, pas la vue du site).
      if (modal.tabsRow) ctx.hide(modal.tabsRow);

      // « Signaler l'image » : sur l'image de la carte, en bas à droite.
      const reportHost = modal.imageArea ?? modal.face;
      if (modal.reportButton && reportHost) {
        if (modal.reportBlock) ctx.hide(modal.reportBlock);
        reports.render(modal.root, siteReportButton(modal.reportButton), { parent: reportHost });
      }

      const market = { busy: opening.has(modal.root), needsPro: marketNeedsPro(), onClick: () => openMarket(modal) };
      if (modal.auctionButton) renameText(modal.auctionButton, 'Mettre aux enchères', 'Vendre');
      const discard = modal.discardButton;
      if (discard && modal.actionsRow) {
        // Un de mes exemplaires : la rangée du site, Vendre · Marché · Défausser.
        markets.render(modal.root, h(MarketButton, market), { parent: modal.actionsRow, before: discard, inline: true });
      } else if (modal.panel) {
        // Sinon, la nôtre : l'échange et la liste de souhaits de la colonne de droite (boutons du site cachés,
        // déclenchés par les nôtres), et « Marché ».
        for (const control of modal.sideActions) ctx.hide(control);
        const { tradeButton: trade, wishlistButton: wish } = modal;
        markets.render(
          modal.root,
          h(ModalActions, {
            trade: trade ? { pending: false, onClick: () => trade.click() } : modal.tradePending ? { pending: true, onClick: () => {} } : undefined,
            wishlist: wish && {
              active: modal.wishlisted,
              title: [textOf(wish), modal.wishlistHint].filter(Boolean).join('\n'),
              busy: wishing.has(modal.root),
              onClick: () => wish.click(),
            },
            market,
          }),
          { parent: modal.panel },
        );
      }
      markDiscarding(modal);
    }

    function sync(): void {
      if (signal.aborted) return;
      const modals = findCardModals();
      const roots = new Set(modals.map((modal) => modal.root));
      reports.prune((root) => roots.has(root));
      markets.prune((root) => roots.has(root));
      for (const modal of modals) apply(modal);
    }

    watchDom(sync, { signal });
    onProStatusChange(sync, { signal });
    ctx.onDispose(() => unlockAll(OWNER));
  },
};
