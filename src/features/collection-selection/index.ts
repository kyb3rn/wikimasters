import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { textOf } from '@/core/text';
import { autoConfirm, confirmStep } from '@/services/site-confirm';
import {
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
import { COLLECTION_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { STAMPS, syncStamps, unstampAll } from '@/ui/stamp';
import { toast } from '@/ui/toast';
import { SelectionActions, SelectionToggle } from './views';

const LEVEL = 'wm-selection-level';
const ACTIONS = 'wm-selection-actions';
const BAR = 'wm-selection-bar';
/** Propriétaire du gris des cartes non cochées (la case à cocher, à côté de la face, ne l'est pas). */
const OWNER = 'collection-selection';
/** « Défausser tout » : notre bouton, qui confirme en deux clics. */
const DISCARD_ALL = 'discard-all';

// Mise en page seulement : les boutons sont ceux de `buttonClass`, le compte et les pastilles portent les classes du site.
const CSS = `
/* Côté droit de la ligne des filtres (sa largeur : collection-filters), contenu calé à droite. */
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
`;

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
    /** Dernier compte lu (la barre affiche « Actualisation… » pendant un chargement). */
    let count = 0;

    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(signal);
    const toggle = createSlot(signal);
    const actions = createSlot(signal);
    /** Barres du bas recalées (variables posées sur elles). */
    const fitted = new Set<HTMLElement>();
    const step = confirmStep<typeof DISCARD_ALL>({ onChange: () => sync(), signal });
    const confirm = autoConfirm({
      find: findBulkDiscardConfirm,
      request: isBulkDiscard,
      onRefused: (message, status) => {
        log.warn('défausse de la sélection refusée', status ?? 'sans réponse', message);
        toast.error(message, { title: 'Défausse impossible' });
      },
      onChange: () => sync(),
      signal,
    });

    function onDiscard(): void {
      const bar = findSelectionBar();
      if (!bar?.discard || bar.discard.disabled || confirm.pending || !step.press(DISCARD_ALL)) return;
      confirm.arm();
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
      if (site) ctx.hide(site.button);
      if (active === undefined || !line) {
        toggle.clear();
        return;
      }
      // Au bout de la ligne des filtres.
      toggle.render(h(SelectionToggle, { active, count, onClick: () => findSelectionMode()?.toggle() }), {
        parent: line,
        before: null,
        className: LEVEL,
      });
    }

    function placeActions(bar: SelectionBar | undefined): void {
      if (!bar) {
        actions.clear();
        return;
      }
      ctx.hide(bar.row);
      if (bar.error) ctx.hide(bar.error);
      fitBar(bar.root);
      const site = (button: HTMLButtonElement | undefined) => button && { label: textOf(button), disabled: button.disabled };
      const vnode = h(SelectionActions, {
        selectPage: bar.selectPage && { disabled: bar.selectPage.disabled, pageSelected: bar.pageSelected },
        tag: site(bar.tag),
        untag: bar.untag && { label: 'Désétiqueter', disabled: bar.untag.disabled },
        discard: bar.discard && { disabled: bar.discard.disabled, stage: step.stage(DISCARD_ALL), busy: confirm.confirmed },
        onSelectPage: click((current) => current.selectPage),
        onTag: click((current) => current.tag),
        onUntag: click((current) => current.untag),
        onDiscard,
      });
      actions.render(vnode, { parent: bar.root, before: bar.row, className: ACTIONS });
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
      marks.set(root, BAR, true);
      fitted.add(root);
    }

    /** Une carte déjà tamponnée (défaussée, en vente) garde son tampon (`stampFace`). */
    function syncDim(active: boolean): void {
      const unchecked = active
        ? findCollectionFaces().filter((face) => {
            const mark = selectionMarkOf(face);
            return mark !== undefined && !mark.selected;
          })
        : [];
      syncStamps(OWNER, unchecked.map((face) => [face, STAMPS.greyed] as const));
    }

    function sync(): void {
      confirm.sync();
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
      unstampAll(OWNER);
      for (const root of fitted) {
        root.style.removeProperty('--wm-bar-center');
        root.style.removeProperty('--wm-bar-width');
      }
    });
  },
};
