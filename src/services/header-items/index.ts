import type { ComponentChild } from 'preact';
import { injectStyle, ROOT_CLASS, watchDom } from '@/core/dom';
import { findBalanceButtons, headerSlot, markHeaderItem } from '@/site/header';
import { createSlots } from '@/ui/mount';

const ITEM = 'wm-header-item';

/* La boîte du solde laisse passer les clics (`pointer-events: none`), sauf sur ses boutons. Écarts : header-bar. */
const CSS = `.${ROOT_CLASS}.${ITEM} > * { pointer-events: auto; }`;

export interface HeaderItemOptions {
  readonly signal: AbortSignal;
  /** Faux : retiré de l'en-tête (relu à chaque passe, et par `sync`). */
  readonly shown?: () => boolean;
}

export interface HeaderItem {
  /** Remet l'en-tête comme il doit être : à appeler quand `shown` change. */
  sync(): void;
}

/**
 * Notre bouton (`render`) devant chaque bouton du solde (barre mobile et boîte ordinateur), à son rang parmi les
 * nôtres (`HEADER_RANKS`), reposé si React les recrée. À appeler une fois `<body>` là.
 */
export function placeHeaderItem(rank: number, render: () => ComponentChild, options: HeaderItemOptions): HeaderItem {
  const { signal, shown } = options;
  const slots = createSlots<HTMLButtonElement>(signal);

  function sync(): void {
    if (signal.aborted) return;
    const balances = shown?.() === false ? [] : findBalanceButtons();
    slots.prune((balance) => balances.includes(balance));
    for (const balance of balances) {
      const parent = balance.parentElement;
      if (!parent) continue;
      const ui = slots.render(balance, render(), { parent, before: headerSlot(balance, rank), inline: true, className: ITEM });
      markHeaderItem(ui.element, rank);
    }
  }

  injectStyle('header-items', CSS);
  watchDom(sync, { signal });
  return { sync };
}
