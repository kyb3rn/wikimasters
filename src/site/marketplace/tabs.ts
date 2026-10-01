import { textOf } from '@/core/text';
import { findUnderlinedTabBars } from '@/site/tabs';

/**
 * Onglets du marché (captures du 29/09/2026) : dans `div.flex-1.p-4.md:p-6.space-y-6`, après l'en-tête,
 * `div.flex.overflow-x-auto.border-b` › un bouton par onglet (« Parcourir », « Mes ventes (n/max) », « Mes enchères (n) »,
 * « Gagnées (n) », « Historique (n) » ; choisi : `border-b-2`), puis le contenu de l'onglet choisi en frères suivants.
 */
export interface MarketplaceTabs {
  readonly bar: HTMLElement;
  readonly browse: HTMLButtonElement;
}

export function findMarketplaceTabs(doc: Document = document): MarketplaceTabs | undefined {
  const main = doc.querySelector('main');
  for (const bar of main ? findUnderlinedTabBars(main) : []) {
    const browse = [...bar.children].find(
      (child): child is HTMLButtonElement => child instanceof HTMLButtonElement && textOf(child) === 'Parcourir',
    );
    if (browse) return { bar, browse };
  }
  return undefined;
}
