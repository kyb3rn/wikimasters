import { h } from 'preact';
import { classMarks } from '@/core/dom';
import type { FeatureContext } from '@/core/runtime';
import { textOf } from '@/core/text';
import { findSelectionToggle, selectionMarkOf, type SelectionBar, type SelectionMode } from '@/site/selection';
import { createSlot, type Placement } from '@/ui/mount';
import { STAMPS, syncStamps, unstampAll } from '@/ui/stamp';
import { toast } from '@/ui/toast';
import { SelectionActions, SelectionToggle, type SelectionAction } from './views';

/** Côté droit de la ligne des filtres : compte et bouton du mode. */
export const SELECTION_LEVEL = 'wm-selection-level';
const ACTIONS = 'wm-selection-actions';
const BAR = 'wm-selection-bar';

// Mise en page seulement : les boutons sont ceux de `buttonClass`, le compte et les pastilles portent les classes du site.
const CSS = `
.${SELECTION_LEVEL} { display: flex; align-items: center; justify-content: flex-end; gap: 12px; }
.${SELECTION_LEVEL} .wm-selection-count { white-space: nowrap; }
/* Barre du bas resserrée sur ses boutons (sa marge intérieure de chaque côté), centrée là où le site la
   place : il la cale sur la largeur du contenu de la page (left, width en style), 768 px au plus. */
.${BAR} { left: var(--wm-bar-center) !important; width: max-content !important; max-width: var(--wm-bar-width); translate: -50% 0; }
.${ACTIONS} { display: flex; flex-wrap: wrap; justify-content: center; gap: 8px; }
.wm-swap { display: inline-grid; }
.wm-swap > span { grid-area: 1 / 1; display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; }
.wm-swap > [data-off] { visibility: hidden; }
`;

export interface SelectionView {
  /** Mode sélection de la page ; `undefined` : pas de bouton. */
  readonly mode: SelectionMode | undefined;
  /** Où poser le compte et le bouton du mode ; `undefined` : pas de bouton. */
  readonly spot: Omit<Placement, 'className' | 'inline'> | undefined;
  /** Barre du bas du site (en sélection) et nos boutons à la place des siens. */
  readonly bar: SelectionBar | undefined;
  readonly actions: readonly SelectionAction[];
  /** Faces de la grille : en sélection, celles qui ne sont pas cochées sont grisées. */
  readonly faces: readonly HTMLElement[];
  /**
   * Titre du toast qui montre l'erreur de la barre (cachée avec elle), une fois par apparition ; absent : elle n'est
   * pas montrée (déjà signalée autrement).
   */
  readonly errorTitle?: string;
}

export interface SelectionUi {
  /** À chaque passe (`watchDom`) : n'écrit que ce qui change. */
  render(view: SelectionView): void;
}

/**
 * Mode sélection présenté de même sur chaque page (le site reste le moteur : ses boutons, cachés, sont cliqués par
 * les nôtres). Le bouton du mode, à icône seule, passe au bout de la ligne des filtres, précédé de « n sélectionnées » ;
 * la barre du bas ne garde que les boutons, à l'allure des actions de la modale de carte ; en sélection, les cartes non
 * cochées sont grisées (`owner` : propriétaire de ce gris). `sync` : la passe de la page, relancée quand la fenêtre
 * change de taille (le site recale alors la barre en changeant son style, que `watchDom` ne suit pas).
 */
export function createSelectionUi(ctx: FeatureContext, { owner, sync }: { readonly owner: string; readonly sync: () => void }): SelectionUi {
  const { signal } = ctx;
  ctx.style(CSS, 'selection');
  const marks = classMarks(signal);
  const toggle = createSlot(signal);
  const actions = createSlot(signal);
  /** Barres du bas recalées (variables posées sur elles). */
  const fitted = new Set<HTMLElement>();
  /** Dernier compte lu (la barre affiche « Actualisation… » pendant un chargement). */
  let count = 0;
  /** Erreur de la barre déjà vue (le site la garde affichée jusqu'à l'action suivante). */
  let shownError = '';

  function setVar(element: HTMLElement, name: string, value: string): void {
    if (element.style.getPropertyValue(name) !== value) element.style.setProperty(name, value);
  }

  /**
   * Centrée comme celle du site ; au plus aussi large que la sienne sans son plafond de 768 px (contenu de la page moins
   * 48 px, 32 sur un écran étroit) : nos boutons, plus grands que les siens, tiennent sur une rangée tant qu'ils le peuvent.
   */
  function fitBar(root: HTMLElement): void {
    const left = Number.parseFloat(root.style.left);
    const width = Number.parseFloat(root.style.width);
    if (!Number.isFinite(left) || !Number.isFinite(width)) return;
    const main = document.querySelector('main')?.getBoundingClientRect().width;
    const room = main === undefined ? width : Math.max(width, main - (window.innerWidth >= 768 ? 48 : 32));
    setVar(root, '--wm-bar-center', `${left + width / 2}px`);
    setVar(root, '--wm-bar-width', `${room}px`);
    marks.set(root, BAR, true);
    fitted.add(root);
  }

  function placeToggle(mode: SelectionMode | undefined, spot: SelectionView['spot']): void {
    const site = findSelectionToggle();
    if (site) ctx.hide(site.button);
    if (!mode || !spot) {
      toggle.clear();
      return;
    }
    const vnode = h(SelectionToggle, { active: mode.active, count, disabled: mode.disabled, onClick: () => mode.toggle() });
    toggle.render(vnode, { ...spot, className: SELECTION_LEVEL });
  }

  function placeActions(bar: SelectionBar | undefined, list: readonly SelectionAction[]): void {
    if (!bar) {
      actions.clear();
      return;
    }
    ctx.hide(bar.row);
    if (bar.error) ctx.hide(bar.error);
    fitBar(bar.root);
    actions.render(h(SelectionActions, { actions: list }), { parent: bar.root, before: bar.row, className: ACTIONS });
  }

  function reportError(bar: SelectionBar | undefined, title: string | undefined): void {
    const message = bar?.error ? textOf(bar.error) : '';
    if (message && message !== shownError && title) {
      ctx.log.warn('action de la sélection refusée', message);
      toast.error(message, { title });
    }
    shownError = message;
  }

  /** Une carte déjà tamponnée (défaussée, en vente) garde son tampon (`stampFace`). */
  function dim(active: boolean, faces: readonly HTMLElement[]): void {
    const unchecked = active
      ? faces.filter((face) => {
          const mark = selectionMarkOf(face);
          return mark !== undefined && !mark.selected;
        })
      : [];
    syncStamps(owner, unchecked.map((face) => [face, STAMPS.greyed] as const));
  }

  window.addEventListener('resize', () => requestAnimationFrame(sync), { signal });
  ctx.onDispose(() => {
    unstampAll(owner);
    for (const root of fitted) {
      root.style.removeProperty('--wm-bar-center');
      root.style.removeProperty('--wm-bar-width');
    }
  });

  return {
    render({ mode, spot, bar, actions: list, faces, errorTitle }) {
      const active = mode?.active === true;
      reportError(bar, errorTitle);
      if (bar?.count !== undefined) count = bar.count;
      if (!active) count = 0;
      placeToggle(mode, spot);
      placeActions(active ? bar : undefined, list);
      dim(active, faces);
    },
  };
}
