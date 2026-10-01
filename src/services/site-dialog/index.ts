import type { ComponentChild } from 'preact';
import { watchDom } from '@/core/dom';
import type { FeatureContext } from '@/core/runtime';
import { createSlot } from '@/ui/mount';

export interface SiteDialogSource {
  /** Ce qui est caché tant que notre fenêtre le remplace (la fenêtre ou le formulaire du site). */
  readonly root: HTMLElement;
}

export interface MirroredDialog {
  /** Redessine tout de suite (un état à nous a changé, sans mutation de la page). */
  refresh(): void;
}

/**
 * Notre fenêtre à la place d'une fenêtre (ou d'un formulaire) du site, cachée, qui reste le moteur : ses données, ses
 * actions, sa fermeture. Montée tant que `find` la trouve, redessinée à chaque changement de la page, démontée quand
 * elle disparaît (fermée par le site, ou par nous à travers elle) ; une autre ouverture repart d'une fenêtre neuve.
 * `onClose` : notre fenêtre vient d'être démontée. À appeler une fois `<body>` là (`ctx.ready()`).
 */
export function mirrorSiteDialog<T extends SiteDialogSource>(
  ctx: FeatureContext,
  options: { readonly find: () => T | undefined; readonly render: (source: T) => ComponentChild; readonly onClose?: () => void },
): MirroredDialog {
  const slot = createSlot(ctx.signal);
  let shown: HTMLElement | undefined;

  function sync(): void {
    if (ctx.signal.aborted) return;
    const source = options.find();
    if (shown && shown !== source?.root) {
      shown = undefined;
      slot.clear();
      options.onClose?.();
    }
    if (!source) return;
    shown = source.root;
    ctx.hide(source.root);
    slot.render(options.render(source), { parent: document.body });
  }

  watchDom(sync, { signal: ctx.signal });
  return { refresh: sync };
}
