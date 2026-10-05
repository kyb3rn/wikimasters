import { textOf } from '@/core/text';
import { SITE_OVERLAY } from '@/site/modals';

/*
 * Modale « Détail de l'échange » (capture du 29/09/2026), ouverte depuis /trades et la page Amis : fond
 * `fixed inset-0 z-50`, cadre `max-w-4xl max-h-[90vh]`, en-tête `h2` « Détail de l'échange » puis
 * `p` « avec <span accent>pseudo</span> », croix.
 */

export interface TradeDetail {
  readonly frame: HTMLElement;
  /** Pseudo de l'autre joueur. */
  readonly friend: string;
  /** Son pseudo sous le titre (« avec <span> »). */
  readonly friendName: HTMLElement;
}

const FRAME = `${SITE_OVERLAY} > div.max-w-4xl`;
const TITLE = /^Détail de l['’]échange$/;

/** Modale « Détail de l'échange », si elle est ouverte. */
export function findTradeDetail(doc: Document = document): TradeDetail | undefined {
  for (const frame of doc.querySelectorAll<HTMLElement>(FRAME)) {
    const title = frame.querySelector('h2');
    if (!title || !TITLE.test(textOf(title))) continue;
    const friendName = title.parentElement?.querySelector<HTMLElement>(':scope > p > span');
    const friend = friendName?.textContent?.trim();
    if (friendName && friend) return { frame, friend, friendName };
  }
  return undefined;
}
