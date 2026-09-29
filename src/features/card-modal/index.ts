import { h, type ComponentChild } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { findCardModals, findDiscardConfirm, readDiscard, type CardModal } from '@/site/cards';
import { lockControl, unlockAll } from '@/ui/lock';
import { mountUi, type MountedUi } from '@/ui/mount';
import { MarketButton, ReportButton } from './buttons';
import { CSS, DISCARD_BUSY } from './style';

const OWNER = 'card-modal-layout';
/**
 * Défausse réussie : la roue reste le temps que le site ferme la modale (ou que `card-modal-stay` la
 * garde, verrouillée), sans que le bouton redevienne actif entre-temps.
 */
const SETTLED_MS = 300;

interface Slot {
  readonly ui: MountedUi;
  readonly controller: AbortController;
}

interface ModalSlots {
  report?: Slot;
  market?: Slot;
}

const text = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Classes du site d'un élément, sans les nôtres (`wm-…`). */
const siteClasses = (element: Element) =>
  [...element.classList].filter((name) => !name.startsWith('wm-')).join(' ');

/** Remplace le texte d'un bouton du site (son nœud texte), sans toucher à son icône. Idempotent. */
function renameButton(button: HTMLButtonElement, from: string, to: string): void {
  for (const node of button.childNodes) {
    if (node.nodeType === Node.TEXT_NODE && node.textContent?.trim() === from) node.textContent = to;
  }
}

export const cardModalLayout: Feature = {
  id: 'card-modal-layout',
  name: 'Modale de carte',
  description:
    'Présentation de la modale de carte : signalement sur l’image, actions Vendre · Marché · Défausser (roue pendant la défausse).',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('card-modal', CSS);

    const slots = new Map<HTMLElement, ModalSlots>();
    /** Modales ouvertes au départ d'une défausse du site → défausses en cours. */
    const discarding = new Map<HTMLElement, number>();

    // Défausse partie de la modale (défaussage rapide ou confirmation du site), jusqu'à la réponse ou l'échec réseau.
    net.track(
      (request) => readDiscard(request) !== undefined && !request.own,
      () => {
        const roots = findCardModals().map((modal) => modal.root);
        for (const root of roots) discarding.set(root, (discarding.get(root) ?? 0) + 1);
        sync();
        return (status) => {
          const done = () => {
            for (const root of roots) {
              const left = (discarding.get(root) ?? 1) - 1;
              if (left > 0) discarding.set(root, left);
              else discarding.delete(root);
            }
            sync();
          };
          if (status !== undefined && status < 400) setTimeout(done, SETTLED_MS);
          else done();
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
        if (!button) continue;
        setClass(button, DISCARD_BUSY, busy);
        lockControl(button, { owner: OWNER, locked: busy, reason: 'Défausse en cours…' });
      }
    }

    /** Monte ou met à jour une interface à nous à l'endroit voulu ; remontée si React a bougé les choses. */
    function place(current: Slot | undefined, vnode: ComponentChild, parent: Element, before: Element | null, inline: boolean): Slot {
      const placed = current?.ui.element.parentElement === parent && (before === null || current.ui.element.nextElementSibling === before);
      if (current && placed) {
        current.ui.update(vnode);
        return current;
      }
      current?.controller.abort();
      const controller = childController(signal);
      const ui = mountUi(vnode, { parent, before, inline, signal: controller.signal });
      return { ui, controller };
    }

    function apply(modal: CardModal, own: ModalSlots): void {
      // La rareté en toutes lettres et les onglets Détails / Marché : la rareté se voit sur la carte,
      // le marché passe dans les actions.
      if (modal.tabsRow) setClass(modal.tabsRow, 'wm-hidden', true);

      // « Signaler l'image » : sur l'image de la carte, en bas à droite.
      const reportHost = modal.imageArea ?? modal.face;
      const report = modal.reportButton;
      if (report && reportHost) {
        if (modal.reportBlock) setClass(modal.reportBlock, 'wm-hidden', true);
        own.report = place(
          own.report,
          h(ReportButton, {
            label: text(report) || "Signaler l'image",
            disabled: report.disabled,
            pressed: report.getAttribute('aria-pressed') === 'true',
            onClick: () => report.click(),
          }),
          reportHost,
          null,
          false,
        );
      }

      // Actions : Vendre · Marché · Défausser.
      if (modal.auctionButton) renameButton(modal.auctionButton, 'Mettre aux enchères', 'Vendre');
      const discard = modal.discardButton;
      const { marketTab, detailsTab, actionsRow } = modal;
      if (discard && marketTab && actionsRow) {
        own.market = place(
          own.market,
          h(MarketButton, {
            className: siteClasses(discard),
            active: marketTab.getAttribute('aria-selected') === 'true',
            onClick: () => {
              const showing = marketTab.getAttribute('aria-selected') === 'true';
              (showing ? detailsTab : marketTab)?.click();
            },
          }),
          actionsRow,
          discard,
          true,
        );
      }
      if (discard) setClass(discard, 'wm-danger', true);
      markDiscarding(modal);
    }

    function sync(): void {
      if (signal.aborted) return;
      const modals = findCardModals();
      for (const [root, own] of slots) {
        if (modals.some((modal) => modal.root === root)) continue;
        own.report?.controller.abort();
        own.market?.controller.abort();
        slots.delete(root);
      }
      for (const modal of modals) {
        const own = slots.get(modal.root) ?? {};
        slots.set(modal.root, own);
        apply(modal, own);
      }
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      document.querySelectorAll(`.${DISCARD_BUSY}`).forEach((el) => el.classList.remove(DISCARD_BUSY));
      unlockAll(OWNER);
    });
  },
};
