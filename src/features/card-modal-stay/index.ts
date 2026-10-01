import { watchDom } from '@/core/dom';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { CARD_MARK_REASONS } from '@/services/card-marks';
import { readDiscard } from '@/site/api';
import { findCardModals, type CardModal } from '@/site/cards';
import { isOwn } from '@/site/dom';
import { SITE_OVERLAY } from '@/site/modals';
import { lockControl, unlockAll } from '@/ui/lock';
import { stampFace, STAMPS, unstampAll } from '@/ui/stamp';
import { DISABLED_OPACITY } from '@/ui/theme';

const OWNER = 'card-modal-stay';
const KEPT = 'wm-kept-modal';
/** Au-delà, une défausse partie n'explique plus la fermeture de la modale. */
const DISCARD_WINDOW_MS = 60_000;
/** Un geste de fermeture de l'utilisateur explique une disparition de la modale pendant ce temps. */
const CLOSE_WINDOW_MS = 1000;
const CLOSE_BUTTON = 'button[aria-label="Fermer"]';

// Remise dans la page, la modale rejouerait son animation d'apparition (`animate-fade-in-up`) : elle
// doit seulement changer d'aspect, sur place. Nos boutons y sont inertes, comme ceux du site.
const CSS = `
.${KEPT}, .${KEPT} * { animation: none !important; }
.${KEPT} .wm-root button { opacity: ${DISABLED_OPACITY}; cursor: not-allowed; }
`;

/**
 * Après une défausse réussie, le site ferme la modale de carte (son rappel `onClose`, qu'on ne peut pas
 * neutraliser). On garde la modale qu'il vient de retirer : remise dans la page avant l'affichage
 * suivant (watchDom passe avant le rendu), elle n'appartient plus à React et devient la nôtre. Elle est
 * inerte : carte marquée « Défaussée », actions verrouillées, fermeture (✕, fond, Échap) gérée ici.
 */
export const cardModalStay: Feature = {
  id: 'card-modal-stay',
  name: 'Défaussage',
  toggleLabel: 'Rester sur la carte après une défausse',
  description: 'La modale ne se ferme plus : la carte reste affichée, marquée « Défaussée ».',
  category: 'Modale de carte',
  routes: 'all',
  async mount(ctx) {
    const { signal, log } = ctx;
    /** Modales de carte ouvertes au départ d'une défausse du site (jusqu'à son échec). */
    const discarding = new Map<HTMLElement, { at: number; path: string }>();
    /** Modales que l'utilisateur vient de fermer lui-même. */
    const closing = new Map<HTMLElement, number>();
    /** Modales gardées (à nous) → page où elles l'ont été. */
    const kept = new Map<HTMLElement, string>();
    let open: HTMLElement[] = [];

    // Suivie jusqu'au bout : refusée, ou sans réponse du tout, elle n'explique plus la fermeture de la modale.
    net.track(
      (request) => readDiscard(request) !== undefined && !request.own,
      () => {
        const roots = findCardModals()
          .map((modal) => modal.root)
          .filter((root) => !kept.has(root));
        for (const root of roots) discarding.set(root, { at: Date.now(), path: location.pathname });
        return (status) => {
          if (status !== undefined && status < 400) return;
          for (const root of roots) discarding.delete(root);
        };
      },
      { signal },
    );

    if (!(await ctx.ready())) return;
    ctx.style(CSS);

    const stop = (event: Event) => {
      event.preventDefault();
      event.stopImmediatePropagation();
    };

    window.addEventListener(
      'click',
      (event) => {
        if (!(event.target instanceof Element)) return;
        const target = event.target;
        const root = target.closest<HTMLElement>(SITE_OVERLAY);
        if (!root) return;
        // Croix du site, ou la nôtre qui la remplace (site-modals) : l'une et l'autre se nomment « Fermer ».
        const closeButton = target.closest(CLOSE_BUTTON);
        const closes = target === root || closeButton?.closest(SITE_OVERLAY) === root;
        if (kept.has(root)) {
          if (closes) {
            stop(event);
            release(root);
            return;
          }
          // Plus rien n'y répond, sauf les liens et le clic sur la carte pour la revoir sans tampon.
          if (target.closest('a[href]') || (target.closest('.wm-stamp-toggle') && !target.closest('button'))) return;
          stop(event);
          return;
        }
        if (closes) closing.set(root, Date.now());
      },
      { capture: true, signal },
    );
    window.addEventListener(
      'keydown',
      (event) => {
        if (event.key !== 'Escape') return;
        const last = [...kept.keys()].pop();
        if (last) {
          stop(event);
          release(last);
          return;
        }
        for (const root of open) closing.set(root, Date.now());
      },
      { capture: true, signal },
    );

    function keep(root: HTMLElement): void {
      // La confirmation du site, encore dans la modale au moment où il l'a retirée.
      root.querySelectorAll(SITE_OVERLAY).forEach((overlay) => overlay.remove());
      root.classList.add(KEPT);
      document.body.append(root);
      kept.set(root, location.pathname);
      // Défausse soldée : fermer ensuite cette modale ne doit pas la faire garder à nouveau.
      discarding.delete(root);
      open = open.filter((other) => other !== root);
      log.debug('modale gardée après la défausse');
    }

    function release(root: HTMLElement): void {
      kept.delete(root);
      root.remove();
    }

    function decorate(modal: CardModal): void {
      if (modal.face) stampFace(modal.face, OWNER, { ...STAMPS.discarded, revealable: true });
      for (const control of modal.root.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input')) {
        if (isOwn(control) || control === modal.closeButton) continue;
        lockControl(control, { owner: OWNER, locked: true, reason: CARD_MARK_REASONS.discarded });
      }
    }

    /** La modale que le site vient de retirer l'a été par sa défausse (et pas par l'utilisateur) ? */
    function keepIfDiscarded(root: HTMLElement): void {
      if (root.isConnected || kept.has(root)) return;
      const now = Date.now();
      const started = discarding.get(root);
      const closedByUser = now - (closing.get(root) ?? 0) < CLOSE_WINDOW_MS;
      if (started && now - started.at < DISCARD_WINDOW_MS && started.path === location.pathname && !closedByUser) {
        keep(root);
      }
    }

    // Tout de suite après le retrait (et non à l'image suivante, comme watchDom) : aucun affichage sans elle.
    const removals = new MutationObserver((records) => {
      for (const record of records) {
        for (const node of record.removedNodes) if (node instanceof HTMLElement && open.includes(node)) keepIfDiscarded(node);
      }
    });
    removals.observe(document.body, { childList: true });
    signal.addEventListener('abort', () => removals.disconnect(), { once: true });

    function sync(): void {
      const now = Date.now();
      for (const root of open) keepIfDiscarded(root);
      const modals = findCardModals();
      open = modals.map((modal) => modal.root).filter((root) => !kept.has(root));
      // Une autre modale du site s'ouvre, ou on change de page : la modale gardée s'en va.
      for (const [root, path] of kept) if (open.length > 0 || path !== location.pathname) release(root);
      for (const modal of modals) if (kept.has(modal.root)) decorate(modal);
      for (const root of [...discarding.keys()]) if (!root.isConnected) discarding.delete(root);
      for (const [root, at] of closing) if (now - at >= CLOSE_WINDOW_MS) closing.delete(root);
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      for (const root of [...kept.keys()]) release(root);
      unlockAll(OWNER);
      unstampAll(OWNER);
    });
  },
};
