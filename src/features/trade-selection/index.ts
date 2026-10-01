import { classMarks, watchDom, type ClassMarks } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findTradeComposer, type TradeCardCell } from '@/site/trades';
import { siteClass } from '@/ui/site';

const CONTENT = 'wm-trade-content';
const FILTERS = 'wm-trade-filters';
const SELECTED = 'wm-trade-selected';
const CARDS = 'wm-trade-cards';
const CELL = 'wm-trade-cell';
const VEIL = 'wm-trade-veil';
const BOX = 'wm-trade-box';

/*
 * Filtres en haut, puis les cartes choisies (sans leur titre « Sélectionnées (n) », le trait du site les sépare
 * des autres), puis les autres : ordre en CSS, React garde le sien. Chaque case comme en sélection dans la
 * Collection : sans le cadre ni la teinte du site (ni son `overflow: hidden`, qui couperait l'anneau).
 */
const CSS = `
.${CONTENT} { display: flex; flex-direction: column; }
.${CONTENT} > .${FILTERS} { order: 0; }
.${CONTENT} > .${SELECTED} { order: 1; }
.${CONTENT} > .${CARDS} { order: 2; }
.${SELECTED} > p { display: none !important; }
.${CELL}.${CELL} { overflow: visible; border-color: transparent; box-shadow: none; }
.${CELL} > div.absolute.inset-0:not(.${VEIL}) { display: none !important; }
`;

type CellState = 'checked' | 'idle' | 'locked';

const SVG = (paths: string, size: string) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" ` +
  `stroke-linecap="round" stroke-linejoin="round" class="${size}" aria-hidden="true">${paths}</svg>`;

const LOOK: Readonly<Record<CellState, { readonly veil: string; readonly box: string; readonly icon: string }>> = {
  checked: {
    veil: `${siteClass.selectionVeil} ${siteClass.selectionVeilChecked}`,
    box: `${siteClass.selectionBox} ${siteClass.selectionBoxChecked}`,
    icon: SVG('<path d="M20 6 9 17l-5-5"/>', 'size-4'),
  },
  idle: { veil: `${siteClass.selectionVeil} ${siteClass.selectionVeilIdle}`, box: `${siteClass.selectionBox} ${siteClass.selectionBoxIdle}`, icon: '' },
  locked: {
    veil: `${siteClass.selectionVeil} ${siteClass.selectionVeilIdle}`,
    box: `${siteClass.selectionBox} ${siteClass.selectionBoxLocked}`,
    icon: SVG('<path d="M18 6 6 18"/><path d="m6 6 12 12"/>', 'size-3.5 opacity-70'),
  },
};

/** Voile et case à cocher de la case, posés une fois, réécrits seulement quand son état change. */
function dress({ button, selected, locked }: TradeCardCell, marks: ClassMarks): void {
  marks.set(button, CELL, true);
  // Comme la case de la Collection : son survol fait grandir le voile avec la face.
  marks.set(button, siteClass.selectionCell, true);
  const state: CellState = selected ? 'checked' : locked ? 'locked' : 'idle';
  let veil = button.querySelector<HTMLElement>(`:scope > .${VEIL}`);
  let box = button.querySelector<HTMLElement>(`:scope > .${BOX}`);
  if (!veil) {
    veil = document.createElement('div');
    veil.setAttribute('aria-hidden', 'true');
    button.append(veil);
  }
  if (!box) {
    box = document.createElement('span');
    box.setAttribute('aria-hidden', 'true');
    button.append(box);
  }
  if (veil.dataset.wmState === state && box.dataset.wmState === state) return;
  const look = LOOK[state];
  veil.className = `${look.veil} ${VEIL}`;
  box.className = `${look.box} ${BOX}`;
  box.innerHTML = look.icon;
  veil.dataset.wmState = state;
  box.dataset.wmState = state;
}

/**
 * Fenêtre d'échange : les filtres restent en haut, les cartes choisies viennent dessous (séparées des autres par
 * un trait), et chaque carte a l'allure de la sélection de la Collection : anneau et case cochée pour les
 * cartes choisies, case vide pour les autres, barrée pour celles qu'on ne peut pas choisir.
 */
export const tradeSelection: Feature = {
  id: 'trade-selection',
  name: 'Cartes choisies',
  description: "Les cartes choisies d'un échange apparaissent comme la sélection de la Collection.",
  category: 'Échanges',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(signal);
    ctx.onDispose(() => document.querySelectorAll(`.${VEIL}, .${BOX}`).forEach((element) => element.remove()));

    watchDom(
      () => {
        const tab = findTradeComposer()?.tab;
        if (!tab) return;
        marks.set(tab.content, CONTENT, true);
        marks.set(tab.filters, FILTERS, true);
        if (tab.selected) marks.set(tab.selected, SELECTED, true);
        if (tab.cards) marks.set(tab.cards, CARDS, true);
        for (const cell of tab.cells) dress(cell, marks);
      },
      { signal },
    );
  },
};
