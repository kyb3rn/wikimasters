import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { findAuctionModal, type AuctionModal } from '@/site/cards';
import { mountUi, type MountedUi } from '@/ui/mount';
import { saleCard } from './card';
import { SalePanel, type SaleActions } from './SalePanel';
import { settings } from './settings';
import { CSS } from './style';

const SITE_HIDDEN = 'wm-sale-site-hidden';

interface OpenSale {
  readonly siteRoot: HTMLElement;
  readonly controller: AbortController;
  readonly card: HTMLElement | undefined;
  readonly cardTitle: string;
  readonly initialPrice: string;
  ui?: MountedUi;
}

export const auctionModalLayout: Feature = {
  id: 'auction-modal-layout',
  name: 'Mise aux enchères',
  description: 'Carte en grand, mise de départ et durée.',
  category: 'Enchères',
  routes: 'all',
  required: true,
  settings,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('auction-modal', CSS);
    let open: OpenSale | undefined;

    // La modale du site reste le moteur (cachée) : on écrit la mise et la durée dans ses contrôles et on
    // clique ses boutons. Création, fermeture, redirection et messages restent donc ceux du site, et
    // les autres fonctionnalités (auction-stay) voient la même chose qu'avec sa modale.
    const actions: SaleActions = {
      onPrice: (price) => {
        const modal = findAuctionModal();
        if (modal) setReactInputValue(modal.priceInput, price);
      },
      onDuration: (minutes) =>
        findAuctionModal()?.durations.find((duration) => duration.minutes === minutes)?.button.click(),
      onCancel: () => findAuctionModal()?.cancelButton.click(),
      onConfirm: () => {
        const modal = findAuctionModal();
        if (modal && !modal.launchButton.disabled) modal.launchButton.click();
      },
    };

    /** `requested` : durée tout juste demandée au site, qui ne l'appliquera qu'à son prochain rendu. */
    function view(modal: AuctionModal, sale: OpenSale, requested?: number) {
      return h(SalePanel, {
        ...actions,
        card: sale.card,
        cardTitle: sale.cardTitle,
        initialPrice: sale.initialPrice,
        durations: modal.durations.map(({ label, minutes, active }) => ({
          label,
          minutes,
          active: requested === undefined ? active : minutes === requested,
        })),
        quota: modal.quota,
        error: modal.error,
        sending: modal.sending,
        canConfirm: !modal.sending && !modal.launchButton.disabled,
      });
    }

    function openSale(modal: AuctionModal): OpenSale {
      const preferred = modal.durations.find((duration) => duration.minutes === settings.get('defaultDuration'));
      if (preferred && !preferred.active) preferred.button.click();
      const { card, title } = saleCard(modal);
      const sale: OpenSale = {
        siteRoot: modal.root,
        controller: childController(signal),
        card,
        cardTitle: title,
        initialPrice: modal.priceInput.value,
      };
      sale.ui = mountUi(view(modal, sale, preferred?.minutes), { signal: sale.controller.signal });
      return sale;
    }

    watchDom(
      () => {
        const modal = findAuctionModal();
        if (open && open.siteRoot !== modal?.root) {
          open.controller.abort();
          open = undefined;
        }
        if (!modal) return;
        setClass(modal.root, SITE_HIDDEN, true);
        if (!open) open = openSale(modal);
        else open.ui?.update(view(modal, open));
      },
      { signal },
    );
    ctx.onDispose(() => {
      document.querySelectorAll(`.${SITE_HIDDEN}`).forEach((element) => element.classList.remove(SITE_HIDDEN));
    });
  },
};
