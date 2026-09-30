import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findAuctionReport } from '@/site/marketplace';
import { ReportButton } from '@/ui/controls';
import { mountUi, type MountedUi } from '@/ui/mount';

const CSS = `.wm-hidden { display: none !important; }`;

const text = (element: Element) => (element.textContent ?? '').replace(/\s+/g, ' ').trim();

/** Page d'une enchère : « Signaler l'image » sur l'image de la carte, comme dans la modale de carte. */
export const auctionReport: Feature = {
  id: 'auction-report',
  name: 'Page d’une enchère',
  description: 'Page d’une enchère : « Signaler l’image » en bas à droite de l’image de la carte.',
  category: 'Marché',
  routes: ['/marketplace/:id'],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('auction-report', CSS);

    let slot: { ui: MountedUi; controller: AbortController } | undefined;
    let hiddenBlock: HTMLElement | undefined;

    function sync(): void {
      const report = findAuctionReport();
      if (!report) return;
      const { button, block, imageArea } = report;
      setClass(block, 'wm-hidden', true);
      hiddenBlock = block;
      const vnode = h(ReportButton, {
        label: text(button) || "Signaler l'image",
        disabled: button.disabled,
        pressed: button.getAttribute('aria-pressed') === 'true',
        onClick: () => button.click(),
      });
      if (slot && slot.ui.element.parentElement === imageArea) {
        slot.ui.update(vnode);
        return;
      }
      // Carte recréée par React (autre enchère) : on repose le bouton.
      slot?.controller.abort();
      const controller = childController(signal);
      slot = { ui: mountUi(vnode, { parent: imageArea, signal: controller.signal }), controller };
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      if (hiddenBlock) setClass(hiddenBlock, 'wm-hidden', false);
    });
  },
};
