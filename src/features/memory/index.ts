import { h } from 'preact';
import { childController } from '@/core/async';
import { expose } from '@/core/expose';
import type { Feature } from '@/core/runtime';
import { placeHeaderItem } from '@/services/header-items';
import { HEADER_RANKS } from '@/site/header';
import { mountUi } from '@/ui/mount';
import { MemoryButton } from './MemoryButton';
import { MemoryPanel } from './MemoryPanel';
import { CSS } from './style';
import { memorySets } from './tabs';

interface MemoryConsole {
  /** Où sont rangées toutes les données déclarées (clés du localStorage, `idb:<base>/<magasin>`). */
  storage(): string[];
}

declare module '@/core/expose' {
  interface WmApi {
    memory?: MemoryConsole;
  }
}

/**
 * Fenêtre Mémoire (demande de l'utilisateur, 04/10) : tout ce que le script garde dans ce navigateur, par type de
 * donnée, à explorer, supprimer, exporter et importer. Bouton à gauche de l'engrenage.
 */
export const memory: Feature = {
  id: 'memory',
  name: 'Mémoire',
  description: 'Fenêtre des données gardées par le script.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, catalog, log } = ctx;
    expose('memory', { storage: () => memorySets(catalog).flatMap((set) => set.storage) }, signal);
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
      mountUi(h(MemoryPanel, { catalog, log, signal: panel.signal, onClose: close }), { signal: panel.signal });
    };

    placeHeaderItem(HEADER_RANKS.memory, () => h(MemoryButton, { onClick: open }), { signal });
  },
};
