import { ROOT_CLASS } from '@/core/dom';
import { textOf } from '@/core/text';
import { findUnderlinedTabBars } from '@/site/tabs';

/**
 * Onglets du marché (captures du 29/09/2026) : dans `div.flex-1.p-4.md:p-6.space-y-6`, après l'en-tête,
 * `div.flex.overflow-x-auto.border-b` › un bouton par onglet (« Parcourir », « Mes ventes (n/max) », « Mes enchères (n) »,
 * « Gagnées (n) », « Historique (n) » ; choisi : `border-b-2`), puis le contenu de l'onglet choisi en frères suivants.
 */
export type MarketplaceTab = 'browse' | 'selling' | 'bidding' | 'won' | 'history';

/** Début du texte de chaque onglet, suivi de son compteur sauf pour « Parcourir ». */
const TAB_TEXTS: readonly (readonly [string, MarketplaceTab])[] = [
  ['Parcourir', 'browse'],
  ['Mes ventes', 'selling'],
  ['Mes enchères', 'bidding'],
  ['Gagnées', 'won'],
  ['Historique', 'history'],
];

export interface MarketplaceTabs {
  readonly bar: HTMLElement;
  readonly browse: HTMLButtonElement;
  /** Onglet du site choisi, s'il est reconnu. */
  readonly active: MarketplaceTab | undefined;
  /**
   * Un onglet ajouté par le script (« Recherche avancée ») est choisi (`aria-pressed`) : son contenu remplace celui de
   * l'onglet du site, qui reste choisi en dessous.
   */
  readonly addedActive: boolean;
}

const tabOf = (button: Element) => TAB_TEXTS.find(([text]) => textOf(button).startsWith(text))?.[1];

export function findMarketplaceTabs(doc: Document = document): MarketplaceTabs | undefined {
  const main = doc.querySelector('main');
  for (const bar of main ? findUnderlinedTabBars(main) : []) {
    const buttons = [...bar.children].filter((child): child is HTMLButtonElement => child instanceof HTMLButtonElement);
    const browse = buttons.find((button) => textOf(button) === 'Parcourir');
    if (!browse) continue;
    const chosen = buttons.find((button) => button.classList.contains('border-b-2'));
    const addedActive = bar.querySelector(`.${ROOT_CLASS} button[aria-pressed="true"]`) !== null;
    return { bar, browse, active: chosen && tabOf(chosen), addedActive };
  }
  return undefined;
}
