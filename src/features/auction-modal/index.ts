import { h } from 'preact';
import { childController } from '@/core/async';
import { classMarks, watchDom } from '@/core/dom';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import {
  findAuctionHumanCheck,
  findAuctionModal,
  readAuctionModalCard,
  type AuctionModal,
  type AuctionModalCard,
} from '@/site/cards';
import { SaleWishedPrice, shownInSale, wishedPrice } from '@/services/wished-price';
import { mountUi, type MountedUi } from '@/ui/mount';
import { layers } from '@/ui/theme';
import { saleCard } from './card';
import { lastInRarity, type CardSales, type SaleRecord } from './history';
import { SaleHistoryModal } from './SaleHistoryModal';
import { SalePanel, type SaleActions, type SaleFill, type SaleHistory } from './SalePanel';
import { settings } from './settings';
import { onCardSalesChange, readCardSales } from './store';
import { CSS } from './style';
import { trackSaleHistory } from './track';

/** Modale du site, moteur de la nôtre : cachée, mais affichée (ses contrôles restent cliquables par le script). */
const SITE_HIDDEN = 'wm-sale-site-hidden';
/** « Vérification rapide » du site : à faire par l'utilisateur, posée au-dessus de la nôtre. */
const SITE_ABOVE = 'wm-sale-site-above';

interface OpenSale {
  readonly siteRoot: HTMLElement;
  readonly controller: AbortController;
  readonly card: HTMLElement | undefined;
  readonly cardTitle: string;
  readonly initialPrice: string;
  /** La carte et l'exemplaire, pour l'historique ; illisibles : pas d'historique. */
  readonly listed: AuctionModalCard | undefined;
  /** Historique de la carte, une fois lu (affiché selon le réglage). */
  sales?: CardSales;
  fill?: SaleFill;
  /** Modale « Tout voir » ouverte. */
  allSales?: AbortController;
  ui?: MountedUi;
}

export const auctionModalLayout: Feature = {
  id: 'auction-modal-layout',
  name: 'Mise aux enchères',
  description: 'Carte en grand, mise de départ, durée et historique des mises en vente.',
  category: 'Enchères',
  routes: 'all',
  required: true,
  settings,
  async mount(ctx) {
    const { signal } = ctx;
    // Avant le DOM : une mise en vente partie pendant le chargement est notée quand même.
    trackSaleHistory({ log: ctx.log, signal });
    if (!(await ctx.ready())) return;
    ctx.style(
      `${CSS}.${SITE_HIDDEN} { visibility: hidden !important; pointer-events: none !important; }
.${SITE_ABOVE} { z-index: ${layers.modal} !important; }`,
    );
    const marks = classMarks(signal);
    let open: OpenSale | undefined;
    let fills = 0;

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

    function reuse(sale: OpenSale, record: SaleRecord, auto: boolean) {
      fillIn(sale, record.price, record.minutes, auto);
    }

    function fillIn(sale: OpenSale, price: number, minutes: number | undefined, auto: boolean) {
      sale.fill = { price, minutes, seq: ++fills, auto };
      redraw(sale);
    }

    function history(sale: OpenSale): SaleHistory | undefined {
      const { listed } = sale;
      if (!listed || !settings.get('showHistory')) return undefined;
      return {
        records: sale.sales?.records,
        rarity: listed.card.rarity,
        shiny: listed.shiny,
        onReuse: (record) => reuse(sale, record, false),
        onShowAll: () => showAllSales(sale),
      };
    }

    /** `requested` : durée tout juste demandée au site, qui ne l'appliquera qu'à son prochain rendu. */
    function view(modal: AuctionModal, sale: OpenSale, requested?: number) {
      const verifying = findAuctionHumanCheck() !== undefined;
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
        verifying,
        canConfirm: !modal.sending && !verifying && !modal.launchButton.disabled,
        history: history(sale),
        fill: sale.fill,
        // Version de dev : prix souhaité de la carte dans la rareté de l'exemplaire (Revente).
        renderBelowPrice: __DEV__
          ? (bid: string, take: (price: number) => void, disabled: boolean) => {
              const listed = sale.listed;
              const rarity = listed?.card.rarity;
              if (!listed || !rarity) return null;
              const card = { cardId: listed.card.id, title: listed.card.title, rarity, shiny: listed.shiny };
              return h(SaleWishedPrice, { card, bid, onTake: take, disabled });
            }
          : undefined,
      });
    }

    function redraw(sale: OpenSale) {
      const modal = findAuctionModal();
      if (open === sale && modal?.root === sale.siteRoot) sale.ui?.update(view(modal, sale));
    }

    function showAllSales(sale: OpenSale) {
      const { listed, sales } = sale;
      if (!listed || !sales) return;
      sale.allSales?.abort();
      const controller = childController(sale.controller.signal);
      sale.allSales = controller;
      const close = () => controller.abort();
      const ui = mountUi(
        h(SaleHistoryModal, {
          sales,
          rarity: listed.card.rarity,
          shiny: listed.shiny,
          onReuse: (record) => {
            close();
            if (!findAuctionModal()?.sending) reuse(sale, record, false);
          },
          onClose: close,
        }),
        { signal: controller.signal },
      );
      // Le site ne voit pas les gestes faits dans la modale (clic hors d'un menu, fermeture d'une liste…).
      for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
        ui.element.addEventListener(type, (event) => event.stopPropagation());
      }
    }

    /** Historique de la carte, puis reprise de la dernière mise en vente dans la même rareté (réglages). */
    function loadSales(sale: OpenSale) {
      const { listed } = sale;
      if (!listed) return;
      const cardId = listed.card.id;
      const apply = (sales: CardSales) => {
        sale.sales = sales;
        redraw(sale);
      };
      onCardSalesChange((sales) => sales.cardId === cardId && apply(sales), { signal: sale.controller.signal });
      void readCardSales(cardId).then((stored) => {
        // Déjà là : une mise en vente notée entre-temps.
        if (sale.controller.signal.aborted || sale.sales) return;
        const sales = stored ?? { cardId, title: listed.card.title, records: [] };
        apply(sales);
        const reprise = settings.get('showHistory') && settings.get('reuseLast');
        const last = reprise ? lastInRarity(sales.records, listed.card.rarity, listed.shiny) : undefined;
        if (last) reuse(sale, last, true);
        // Version de dev : sans mise en vente à reprendre, le prix souhaité de la carte dans cette rareté plutôt que la
        // mise du site (demande de l'utilisateur).
        else if (__DEV__ && shownInSale() && listed.card.rarity) {
          const wished = wishedPrice({ cardId, title: listed.card.title, rarity: listed.card.rarity, shiny: listed.shiny });
          if (wished) fillIn(sale, wished.price, undefined, true);
        }
      });
    }

    function openSale(modal: AuctionModal): OpenSale {
      const preferred = modal.durations.find((duration) => duration.minutes === settings.get('defaultDuration'));
      if (preferred && !preferred.active) preferred.button.click();
      const { card, title } = saleCard(modal);
      const listed = readAuctionModalCard(modal);
      if (!listed) ctx.log.warn('carte illisible dans la modale de mise en vente : pas d’historique');
      const sale: OpenSale = {
        siteRoot: modal.root,
        controller: childController(signal),
        card,
        cardTitle: title,
        initialPrice: modal.priceInput.value,
        listed,
      };
      sale.ui = mountUi(view(modal, sale, preferred?.minutes), { signal: sale.controller.signal });
      loadSales(sale);
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
        marks.set(modal.root, SITE_HIDDEN, true);
        // Le site la rend avec la modale d'enchère : elle disparaît avec elle.
        const check = findAuctionHumanCheck();
        if (check) marks.set(check, SITE_ABOVE, true);
        if (!open) open = openSale(modal);
        else open.ui?.update(view(modal, open));
      },
      { signal },
    );
  },
};
