import { h } from 'preact';
import { childController } from '@/core/async';
import type { Feature } from '@/core/runtime';
import { placeHeaderItem } from '@/services/header-items';
import { HEADER_RANKS } from '@/site/header';
import { mountUi } from '@/ui/mount';
import { GearButton } from './GearButton';
import { SettingsPanel } from './SettingsPanel';
import { CSS } from './style';

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
    if (!(await ctx.ready())) return;
    ctx.style(CSS);

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

    // Avant nos autres boutons de l'en-tête (la cloche).
    placeHeaderItem(HEADER_RANKS.gear, () => h(GearButton, { onClick: open }), { signal });
  },
};
