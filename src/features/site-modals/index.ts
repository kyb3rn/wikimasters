import { h } from 'preact';
import { childController } from '@/core/async';
import { guardBackdropClicks, injectStyle, ROOT_CLASS, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { escapeTarget, findSiteModals, isCornerCross, isSiteOverlay, readSiteModal, topSiteModal } from '@/site/modals';
import { CloseButton } from '@/ui/controls';
import { isModalOpen, leaveSmoothly, trackScrolls } from '@/ui/modal';
import { mountUi, type MountedUi } from '@/ui/mount';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';

const SHADE = 'wm-modal-shade';
const HOST = 'wm-modal-host';
const HIDDEN = 'wm-modal-close-hidden';
/** Rangée du titre : place laissée à notre croix (`--wm-modal-room`). */
const ROOM = 'wm-modal-room';
/** Bord droit de notre croix depuis le bord du cadre (`right-3` + `w-9`), plus un écart avec le titre. */
const CROSS_REACH = 12 + 36 + 8;

const CSS = `
.${SHADE}.${SHADE} { background-color: ${tokens.backdrop}; -webkit-backdrop-filter: ${tokens.backdropBlur};
  backdrop-filter: ${tokens.backdropBlur}; }
.${HOST} { position: relative; }
.${HIDDEN} { display: none !important; }
.${ROOM}.${ROOM} { padding-right: var(--wm-modal-room); }
`;

/** Fermeture du site derrière notre croix, relue à chaque passage : React peut recréer son bouton. */
interface Target {
  close: HTMLButtonElement;
}

interface Placed {
  readonly ui: MountedUi;
  readonly controller: AbortController;
  readonly host: HTMLElement;
  readonly target: Target;
}

/** Bloc à cacher pour un bouton : son parent s'il ne contient que lui (marge `mt-5` de l'aide des batailles). */
function blockOf(button: HTMLElement, frame: HTMLElement): HTMLElement {
  const parent = button.parentElement;
  return parent && parent !== frame && parent.childElementCount === 1 ? parent : button;
}

const cross = (target: Target) =>
  h(CloseButton, { class: siteClass.closeButtonPosition, disabled: target.close.disabled, onClick: () => target.close.click() });

export const siteModals: Feature = {
  id: 'site-modals',
  name: 'Modales du site',
  description:
    'Toutes les modales du site ont la même croix ronde dans le coin et le même fond, se ferment par Échap et disparaissent en fondu.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    const placed = new Map<HTMLElement, Placed>();

    // Avant d'attendre la page : passe devant les écouteurs de clic des autres fonctionnalités (card-modal-stay
    // ferme au clic sur le fond la modale de carte qu'il garde).
    guardBackdropClicks(isSiteOverlay, signal);

    await whenBody();
    if (signal.aborted) return;
    injectStyle('site-modals', CSS);
    trackScrolls(signal);

    function remove(frame: HTMLElement): void {
      placed.get(frame)?.controller.abort();
      placed.delete(frame);
    }

    /**
     * Notre croix va dans le cadre, sauf si la croix du site est dans un en-tête collant (Boutique) : dans le cadre,
     * qui défile, elle partirait avec le contenu.
     */
    function hostOf(frame: HTMLElement, close: HTMLElement): HTMLElement {
      for (let element = close.parentElement; element && element !== frame; element = element.parentElement) {
        if (getComputedStyle(element).position === 'sticky') return element;
      }
      return frame;
    }

    function place(frame: HTMLElement, close: HTMLButtonElement): void {
      const host = hostOf(frame, close);
      if (getComputedStyle(host).position === 'static') setClass(host, HOST, true);
      // La rangée du titre (celle de la fermeture du site, sinon le titre lui-même) garde sa mise en page ; seul son
      // bord droit recule pour ne pas passer sous la croix.
      const parent = close.parentElement;
      const row = parent && parent !== host ? parent : host.querySelector<HTMLElement>('h1, h2, h3');
      if (row) {
        const needed = CROSS_REACH - (host.getBoundingClientRect().right - row.getBoundingClientRect().right);
        if (needed > Number.parseFloat(getComputedStyle(row).paddingRight)) {
          row.style.setProperty('--wm-modal-room', `${Math.ceil(needed)}px`);
          setClass(row, ROOM, true);
        }
      }
      const controller = childController(signal);
      const target = { close };
      const ui = mountUi(cross(target), { parent: host, before: host.firstChild, inline: true, signal: controller.signal });
      placed.set(frame, { ui, controller, host, target });
    }

    watchDom(
      () => {
        const seen = new Set<HTMLElement>();
        for (const modal of findSiteModals()) {
          setClass(modal.shade, SHADE, true);
          const { frame, close, dismiss } = modal;
          if (!frame || !close) continue;
          if (dismiss) setClass(blockOf(dismiss, frame), HIDDEN, true);
          if (isCornerCross(close)) continue;
          seen.add(frame);
          setClass(close, HIDDEN, true);
          const current = placed.get(frame);
          if (!current || current.ui.element.parentElement !== current.host) {
            remove(frame);
            place(frame, close);
            continue;
          }
          current.target.close = close;
          current.ui.update(cross(current.target));
        }
        for (const frame of placed.keys()) if (!seen.has(frame)) remove(frame);
      },
      { signal },
    );

    // Le site retire ses modales d'un coup : une copie s'efface à leur place. Une tâche plus tard, pour laisser
    // card-modal-stay garder la modale de carte qu'il remet aussitôt dans la page (plus rien à effacer).
    const removals = new MutationObserver((records) => {
      for (const record of records) {
        const parent = record.target;
        if (parent instanceof Element && parent.closest(`.${ROOT_CLASS}`)) continue;
        for (const node of record.removedNodes) {
          if (!isSiteOverlay(node)) continue;
          const before = record.nextSibling;
          queueMicrotask(() => {
            if (!node.isConnected) leaveSmoothly(node, { parent, before, frame: readSiteModal(node).frame });
          });
        }
      }
    });
    removals.observe(document.body, { childList: true, subtree: true });
    signal.addEventListener('abort', () => removals.disconnect(), { once: true });

    // Échap « tente » de quitter la modale du dessus, après le site : s'il a réagi (sa propre fermeture, une demande
    // de confirmation, une liste qui se replie, `preventDefault`), on n'y touche pas. Écouté avant tout le monde
    // (capture) pour voir la modale telle qu'elle était, puis jugé une tâche plus tard, rendu de React passé.
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape' || isModalOpen()) return;
        const top = topSiteModal();
        if (!top) return;
        let reacted = false;
        const observer = new MutationObserver(() => (reacted = true));
        observer.observe(top.overlay, { childList: true, subtree: true });
        setTimeout(() => {
          observer.disconnect();
          if (event.defaultPrevented || reacted || !top.overlay.isConnected) return;
          if (topSiteModal()?.overlay !== top.overlay) return;
          escapeTarget(top)?.click();
        });
      },
      { capture: true, signal },
    );

    ctx.onDispose(() => {
      for (const frame of [...placed.keys()]) remove(frame);
      for (const element of document.querySelectorAll(`.${SHADE}, .${HOST}, .${HIDDEN}, .${ROOM}`)) {
        element.classList.remove(SHADE, HOST, HIDDEN, ROOM);
        if (element instanceof HTMLElement) element.style.removeProperty('--wm-modal-room');
      }
    });
  },
};
