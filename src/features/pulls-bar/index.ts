import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { onSettingsChange } from '@/core/settings';
import { pullsSoundSettings } from '@/services/pulls-sound';
import { findPackButton, findPackCounter, PULLS_ROUTE } from '@/site/pulls';
import { mountUi, type MountedUi } from '@/ui/mount';
import { tokens } from '@/ui/theme';
import { PacksBar } from './PacksBar';

const HIDDEN = 'wm-pack-counter-hidden';
/** Rangée du site autour de son cadre (avec, à 0 paquet, le bouton d'achat) : retirée de la colonne si elle n'a plus rien d'affiché. */
const BOX = 'wm-pack-counter-box';
/** Fonctionnalité dont l'activation est le choix carrousel / grille (réglage « Apparence » des paquets). */
const GRID_FEATURE = 'pulls-grid';

const CSS = `
.${HIDDEN} { display: none !important; }
.${BOX}:not(:has(> :not(.${HIDDEN}))) { display: none !important; }
.wm-packs-bar { display: flex; align-items: stretch; justify-content: center; }
.wm-packs-part { display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 4px;
  min-width: 7.5rem; padding: 0 1.25rem; text-align: center; }
.wm-packs-part:first-child { padding-left: 0; }
.wm-packs-part:last-child { padding-right: 0; }
.wm-packs-part + .wm-packs-part { border-left: 1px solid ${tokens.border}; }
.wm-packs-value { display: flex; align-items: center; justify-content: center; height: 2.25rem; }
@media (max-width: 520px) {
  .wm-packs-bar { flex-wrap: wrap; row-gap: 12px; }
  .wm-packs-part { flex: 1 1 45%; min-width: 0; padding: 0; }
  .wm-packs-part + .wm-packs-part { border-left: none; }
}
`;

export const pullsBar: Feature = {
  id: 'pulls-bar',
  name: 'Cadre des paquets',
  description: 'Paquets disponibles, recharge, son et affichage des cartes, dans un cadre en largeur au-dessus du paquet.',
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, catalog } = ctx;
    let placed: { readonly ui: MountedUi; readonly controller: AbortController } | undefined;
    /** Cadre du site suivi : le temps restant y est réécrit chaque seconde, en texte seul (hors watchDom). */
    let observed: HTMLElement | undefined;
    const observer = new MutationObserver(() => sync());
    signal.addEventListener('abort', () => observer.disconnect(), { once: true });

    await whenBody();
    if (signal.aborted) return;
    injectStyle('pulls-bar', CSS);

    const gridEnabled = () => catalog.list().find((entry) => entry.feature.id === GRID_FEATURE)?.enabled ?? false;

    function remove(): void {
      placed?.controller.abort();
      placed = undefined;
    }

    function sync(): void {
      if (signal.aborted) return;
      const counter = findPackCounter();
      const box = counter?.root.parentElement;
      // Au-dessus du paquet : son, affichage et recharge valent aussi pour le pack PRO, en dessous.
      const anchor = findPackButton()?.root ?? counter?.root;
      const parent = anchor?.parentElement;
      if (!counter || !box || !anchor || !parent) {
        remove();
        return;
      }
      setClass(counter.root, HIDDEN, true);
      setClass(box, BOX, true);
      if (observed !== counter.root) {
        observer.disconnect();
        observer.observe(counter.root, { childList: true, subtree: true, characterData: true });
        observed = counter.root;
      }
      const vnode = h(PacksBar, {
        available: counter.available,
        max: counter.max,
        next: counter.next,
        sound: pullsSoundSettings.get('enabled'),
        grid: gridEnabled(),
        onSound: () => pullsSoundSettings.set('enabled', !pullsSoundSettings.get('enabled')),
        onGrid: (grid) => catalog.setEnabled(GRID_FEATURE, grid),
      });
      if (placed?.ui.element.parentElement === parent && placed.ui.element.nextElementSibling === anchor) {
        placed.ui.update(vnode);
        return;
      }
      remove();
      const controller = childController(signal);
      placed = { ui: mountUi(vnode, { parent, before: anchor, signal: controller.signal }), controller };
    }

    watchDom(sync, { signal });
    catalog.onChange(sync, { signal });
    onSettingsChange(sync, { signal });
    ctx.onDispose(() => {
      remove();
      document.querySelectorAll(`.${HIDDEN}, .${BOX}`).forEach((el) => el.classList.remove(HIDDEN, BOX));
    });
  },
};
