import { findUnderlinedTabBars } from '@/site/tabs';

/*
 * Page /trades (code du 30/09/2026) :
 *   div.space-y-6
 *     div.flex.items-center.justify-between   en-tête : [h1 « Échanges » + sous-titre] · button « + Proposer un échange »
 *                                            (« Échanger » sous `sm`)
 *     div.flex.border-b                      onglets soulignés (`flex-1 py-3`) : Reçues, Envoyées, Historique
 *     div.space-y-3                          offres de l'onglet
 */

export interface TradesPage {
  /** « Proposer un échange » : ouvre « Choisir un ami ». */
  readonly newTrade: HTMLButtonElement;
  /** Rangée des onglets. */
  readonly tabBar: HTMLElement;
}

/** Rangée d'onglets soulignés précédée de l'en-tête de la page (titre, bouton). */
export function findTradesPage(root: ParentNode = document): TradesPage | undefined {
  const main = root.querySelector('main');
  for (const tabBar of main ? findUnderlinedTabBars(main) : []) {
    const header = tabBar.previousElementSibling;
    if (!header?.querySelector('h1')) continue;
    const newTrade = [...header.children].find((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
    if (newTrade) return { newTrade, tabBar };
  }
  return undefined;
}
