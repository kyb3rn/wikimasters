import { h } from 'preact';
import { childController } from '@/core/async';
import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import type { Feature } from '@/core/runtime';
import {
  COLLECTION_ROUTE,
  findBulkDiscardConfirm,
  findCollectionFaces,
  findCollectionFilters,
  findSelectionBar,
  findSelectionMode,
  findSelectionToggle,
  isBulkDiscard,
  LIST_LOADING_VEIL,
  selectionMarkOf,
  type SelectionBar,
} from '@/site/collection';
import { mountUi, type MountedUi } from '@/ui/mount';
import { isStamped } from '@/ui/stamp';
import { toast } from '@/ui/toast';
import { CONFIRM_ACTIVE_MS, CONFIRM_DELAY_MS, confirmStage } from './confirm';
import { SelectionActions, SelectionToggle } from './views';

const HIDDEN = 'wm-selection-hidden';
const LEVEL = 'wm-selection-level';
const ACTIONS = 'wm-selection-actions';
const BAR = 'wm-selection-bar';
const CONFIRM_HIDDEN = 'wm-selection-confirm-hidden';
/** Face d'une carte non cochée, en sélection : grisée en entier (la case à cocher, à côté, ne l'est pas). */
const DIM = 'wm-selection-dim';
/** Au-delà, une confirmation du site qui s'ouvre n'est plus la suite de notre second clic. */
const ARM_WINDOW_MS = 2000;

// Mise en page seulement : les boutons sont ceux de `buttonClass`, le compte et les pastilles portent les classes du site.
const CSS = `
.${HIDDEN} { display: none !important; }
.${CONFIRM_HIDDEN} { visibility: hidden !important; }
/* Côté droit de la ligne des filtres (sa largeur : collection-filter-line), contenu calé à droite. */
.${LEVEL} { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.${LEVEL} .wm-selection-count { white-space: nowrap; }
/* Barre du bas resserrée sur ses boutons (sa marge intérieure de chaque côté), centrée là où le site la
   place : il la cale sur la largeur du contenu de la page (left, width en style). */
.${BAR} { left: var(--wm-bar-center) !important; width: max-content !important; max-width: var(--wm-bar-width); translate: -50% 0; }
.${ACTIONS} { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.wm-swap { display: inline-grid; }
.wm-swap > span { grid-area: 1 / 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; }
.wm-swap > [data-off] { visibility: hidden; }
/* Voile de chargement du site sur la grille : l'anneau d'une carte cochée dépasse de sa case (4 px, plus
   l'agrandissement au survol) et sortirait du voile au bord de la grille. */
main ${LIST_LOADING_VEIL} { inset: -12px; }
.${DIM} { filter: grayscale(1) brightness(0.55); }
.group:hover .${DIM} { filter: grayscale(1) brightness(0.8); }
`;

interface Placed {
  readonly parent: HTMLElement;
  readonly ui: MountedUi;
  readonly controller: AbortController;
}

/**
 * Mode sélection de la Collection (le site reste le moteur : ses boutons, cachés, sont cliqués par les
 * nôtres). Le bouton du mode, à icône seule, passe au bout de la ligne des filtres, précédé de
 * « n sélectionnées » ; la barre du bas ne garde que les boutons, à l'allure des actions de la modale de
 * carte. « Défausser tout » demande toujours un second clic (« Confirmer ? »), puis la confirmation du site
 * est cachée et acceptée. En sélection, les cartes non cochées sont grisées. Le bouton est là dès la ligne des
 * filtres : celui du site attend les compteurs (total non nul), le mode est alors changé dans l'état de la page.
 */
export const collectionSelection: Feature = {
  id: 'collection-selection',
  name: 'Sélection',
  description: 'Mode sélection de la Collection : bouton dans la ligne des filtres, barre de boutons, défausse en deux clics.',
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    let toggle: Placed | undefined;
    let actions: Placed | undefined;
    /** Dernier compte lu (la barre affiche « Actualisation… » pendant un chargement). */
    let count = 0;
    /** Premier clic sur « Défausser tout ». */
    let confirmingSince: number | undefined;
    /** Second clic : la confirmation du site est attendue, puis acceptée (`confirmed`) et la défausse part. */
    let pending: { readonly at: number; confirmed: boolean } | undefined;
    /** Défausse refusée : sa confirmation (cachée) est à refermer. */
    let dismissing = false;
    const timers = new Set<ReturnType<typeof setTimeout>>();

    const syncIn = (ms: number) => {
      const timer = setTimeout(() => {
        timers.delete(timer);
        sync();
      }, ms);
      timers.add(timer);
    };

    function refused(message: string): void {
      pending = undefined;
      dismissing = true;
      toast.error(message, { title: 'Défausse impossible' });
      sync();
    }

    net.observe(
      (request) => isBulkDiscard(request) && !request.own,
      async (exchange) => {
        if (!pending?.confirmed || exchange.ok) return;
        const body = await exchange.json().catch(() => undefined);
        const message = isRecord(body) && typeof body.error === 'string' ? body.error : `Erreur ${exchange.status} du site.`;
        log.warn('défausse de la sélection refusée', exchange.status, message);
        refused(message);
      },
      { signal },
    );
    net.track(
      (request) => isBulkDiscard(request) && !request.own,
      () => (status) => {
        if (status !== undefined || !pending?.confirmed) return;
        log.warn('défausse de la sélection sans réponse du site');
        refused("Le site n'a pas répondu (erreur réseau).");
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;
    injectStyle('collection-selection', CSS);

    function onDiscard(): void {
      const bar = findSelectionBar();
      if (!bar?.discard || bar.discard.disabled || pending) return;
      const stage = confirmStage(confirmingSince, Date.now());
      if (stage === 'waiting') return;
      if (stage === 'idle') {
        confirmingSince = Date.now();
        syncIn(CONFIRM_DELAY_MS + 20);
        syncIn(CONFIRM_DELAY_MS + CONFIRM_ACTIVE_MS + 20);
        sync();
        return;
      }
      confirmingSince = undefined;
      pending = { at: Date.now(), confirmed: false };
      syncIn(ARM_WINDOW_MS + 20);
      bar.discard.click();
      sync();
    }

    const click = (pick: (bar: SelectionBar) => HTMLButtonElement | undefined) => () => {
      const bar = findSelectionBar();
      const button = bar && pick(bar);
      if (button && !button.disabled) button.click();
    };

    function placeToggle(active: boolean | undefined): void {
      const site = findSelectionToggle();
      const line = findCollectionFilters()?.row.parentElement;
      if (site) setClass(site.button, HIDDEN, true);
      if (active === undefined || !line) {
        toggle?.controller.abort();
        toggle = undefined;
        return;
      }
      const vnode = h(SelectionToggle, { active, count, onClick: () => findSelectionMode()?.toggle() });
      if (toggle?.parent !== line || !toggle.ui.element.isConnected) {
        toggle?.controller.abort();
        const controller = childController(signal);
        toggle = { parent: line, ui: mountUi(vnode, { parent: line, className: LEVEL, signal: controller.signal }), controller };
        return;
      }
      if (line.lastElementChild !== toggle.ui.element) line.append(toggle.ui.element);
      toggle.ui.update(vnode);
    }

    function placeActions(bar: SelectionBar | undefined): void {
      if (!bar) {
        actions?.controller.abort();
        actions = undefined;
        return;
      }
      setClass(bar.row, HIDDEN, true);
      if (bar.error) setClass(bar.error, HIDDEN, true);
      fitBar(bar.root);
      const site = (button: HTMLButtonElement | undefined) =>
        button && { label: (button.textContent ?? '').trim(), disabled: button.disabled };
      const vnode = h(SelectionActions, {
        selectPage: bar.selectPage && { disabled: bar.selectPage.disabled, pageSelected: bar.pageSelected },
        tag: site(bar.tag),
        untag: bar.untag && { label: 'Désétiqueter', disabled: bar.untag.disabled },
        discard: bar.discard && {
          disabled: bar.discard.disabled,
          stage: confirmStage(confirmingSince, Date.now()),
          busy: pending?.confirmed === true,
        },
        onSelectPage: click((current) => current.selectPage),
        onTag: click((current) => current.tag),
        onUntag: click((current) => current.untag),
        onDiscard,
      });
      if (actions?.parent !== bar.root || !actions.ui.element.isConnected) {
        actions?.controller.abort();
        const controller = childController(signal);
        actions = { parent: bar.root, ui: mountUi(vnode, { parent: bar.root, before: bar.row, className: ACTIONS, signal: controller.signal }), controller };
        return;
      }
      actions.ui.update(vnode);
    }

    function setVar(element: HTMLElement, name: string, value: string): void {
      if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
    }

    function fitBar(root: HTMLElement): void {
      const left = Number.parseFloat(root.style.left);
      const width = Number.parseFloat(root.style.width);
      if (!Number.isFinite(left) || !Number.isFinite(width)) return;
      setVar(root, '--wm-bar-center', `${left + width / 2}px`);
      setVar(root, '--wm-bar-width', `${width}px`);
      setClass(root, BAR, true);
    }

    function syncDiscard(): void {
      const now = Date.now();
      if (confirmStage(confirmingSince, now) === 'idle') confirmingSince = undefined;
      if (pending && !pending.confirmed && now - pending.at > ARM_WINDOW_MS) pending = undefined;
      const confirm = findBulkDiscardConfirm();
      if (confirm && pending && !pending.confirmed) {
        pending.confirmed = true;
        confirm.confirmButton.click();
      }
      // Confirmation refermée : défausse faite (le site recharge la page), ou refusée puis refermée ici.
      if (!confirm) {
        if (pending?.confirmed) pending = undefined;
        dismissing = false;
      }
      if (confirm && dismissing && !confirm.cancelButton.disabled) {
        dismissing = false;
        confirm.cancelButton.click();
      }
      if (confirm) setClass(confirm.root, CONFIRM_HIDDEN, pending !== undefined || dismissing);
    }

    /** Une carte tamponnée (défaussée, en vente) est déjà grisée, son tampon doit rester lisible. */
    function syncDim(active: boolean): void {
      for (const face of findCollectionFaces()) {
        const mark = active ? selectionMarkOf(face) : undefined;
        setClass(face, DIM, mark !== undefined && !mark.selected && !isStamped(face));
      }
    }

    function sync(): void {
      syncDiscard();
      const bar = findSelectionBar();
      if (bar?.count !== undefined) count = bar.count;
      const mode = findSelectionMode();
      const active = mode?.active;
      if (!active) count = 0;
      // Sans le bouton du site (compteurs pas encore là, ou collection vide) : seulement s'il y a des cartes.
      const visible = mode !== undefined && (active === true || findSelectionToggle() !== undefined || findCollectionFaces().length > 0);
      placeToggle(visible ? active : undefined);
      placeActions(active ? bar : undefined);
      syncDim(active === true);
    }

    watchDom(sync, { signal });
    // Le site recale la barre en changeant son style, que watchDom ne suit pas.
    window.addEventListener('resize', () => requestAnimationFrame(sync), { signal });
    ctx.onDispose(() => {
      for (const root of document.querySelectorAll<HTMLElement>(`.${BAR}`)) {
        root.classList.remove(BAR);
        root.style.removeProperty('--wm-bar-center');
        root.style.removeProperty('--wm-bar-width');
      }
      for (const timer of timers) clearTimeout(timer);
      toggle?.controller.abort();
      actions?.controller.abort();
      for (const name of [HIDDEN, CONFIRM_HIDDEN, DIM]) {
        document.querySelectorAll(`.${name}`).forEach((element) => element.classList.remove(name));
      }
    });
  },
};
