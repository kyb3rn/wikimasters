import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findBalanceButtons } from '@/site/header';
import { mountUi, type MountedUi } from '@/ui/mount';
import { GearButton } from './GearButton';
import { SettingsPanel } from './SettingsPanel';
import { CSS } from './style';

interface GearSlot {
  readonly ui: MountedUi;
  readonly controller: AbortController;
}

export const settingsPanel: Feature = {
  id: 'settings',
  name: 'Paramètres',
  description: 'Fenêtre de paramètres du script.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, catalog } = ctx;
    await whenBody();
    if (signal.aborted) return;
    injectStyle('settings', CSS);

    let panel: AbortController | undefined;
    const close = () => {
      panel?.abort();
      panel = undefined;
    };
    const open = () => {
      if (panel) return;
      panel = childController(signal);
      mountUi(h(SettingsPanel, { catalog, onClose: close }), { signal: panel.signal });
    };

    // Un engrenage devant chaque bouton du solde (barre mobile et boîte ordinateur), reposé si React les recrée.
    const slots = new Map<HTMLButtonElement, GearSlot>();
    watchDom(
      () => {
        const buttons = findBalanceButtons();
        for (const [button, slot] of slots) {
          const placed = buttons.includes(button) && slot.ui.element.nextElementSibling === button;
          if (!placed) {
            slot.controller.abort();
            slots.delete(button);
          }
        }
        for (const button of buttons) {
          if (slots.has(button) || !button.parentElement) continue;
          const controller = childController(signal);
          const ui = mountUi(h(GearButton, { className: button.className, onClick: open }), {
            parent: button.parentElement,
            before: button,
            inline: true,
            signal: controller.signal,
          });
          slots.set(button, { ui, controller });
        }
      },
      { signal },
    );
    ctx.onDispose(close);
  },
};
