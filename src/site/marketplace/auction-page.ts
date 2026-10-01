import { textOf } from '@/core/text';
import { FACE, findFaceImage } from '@/site/cards';
import { hasIcon } from '@/site/dom';

/**
 * Page d'une enchère, `/marketplace/<auctionId>` (captures du 29 et du 30/09/2026) :
 *
 *   main … div.flex.flex-col.md:flex-row.gap-6
 *     div.flex-shrink-0.flex.flex-col.items-center.gap-2
 *       face `w-72 h-[420px]` (image en haut : `div.absolute.top-0 … h-[45%]`)
 *       div.space-y-1.5 > button « Signaler l'image » (lucide `flag`)
 *     div.flex-1.space-y-4
 *       h1 titre, bouton « Vue du marché »
 *       p « Mis en vente par <span>pseudo</span> »
 *       div.card-frame : « Mise actuelle » / « Mise de départ », p « Meneur : <span>pseudo</span> » (s'il y a une mise), temps restant
 *       …
 *       div.card-frame.p-4.text-sm « Remportée par <span>pseudo</span> pour <span>n</span> wikibidous. » (vendue ; code du site, 30/09/2026)
 *   div.space-y-3 : h2 « Historique des mises (n) », ul.card-frame > li > span pseudo (« Joueur » sans pseudo), span (date, montant)
 *
 * Le meneur et l'historique changent en direct (mises reçues en temps réel).
 */
export interface AuctionPlayer {
  /** `span` du pseudo, rendu par le site. */
  readonly name: HTMLElement;
  readonly username: string;
}

/** Pseudo tel quel, espaces compris. */
const usernameOf = (name: Element) => (name.textContent ?? '').trim();

/** Joueur d'une ligne de l'historique dont le site n'a pas le pseudo. */
const NO_USERNAME = 'Joueur';

/** Vendeur (« Mis en vente par »), meneur (« Meneur : »), gagnant (« Remportée par ») et joueurs de l'historique des mises. */
export function findAuctionPlayers(doc: Document = document): AuctionPlayer[] {
  const names: HTMLElement[] = [];
  for (const line of doc.querySelectorAll<HTMLElement>('main p')) {
    if (!/^(Mis en vente par|Meneur :)/.test(textOf(line))) continue;
    const name = line.querySelector<HTMLElement>(':scope > span');
    if (name) names.push(name);
  }
  for (const line of doc.querySelectorAll<HTMLElement>('main div.card-frame')) {
    if (!textOf(line).startsWith('Remportée par')) continue;
    const name = line.querySelector<HTMLElement>(':scope > span');
    if (name) names.push(name);
  }
  for (const heading of doc.querySelectorAll('main h2')) {
    if (!textOf(heading).startsWith('Historique des mises')) continue;
    const list = heading.nextElementSibling;
    if (list?.tagName !== 'UL') continue;
    for (const name of list.querySelectorAll<HTMLElement>(':scope > li > span:first-child')) {
      if (textOf(name) !== NO_USERNAME) names.push(name);
    }
  }
  return names.map((name) => ({ name, username: usernameOf(name) })).filter((player) => player.username !== '');
}

export interface AuctionReport {
  readonly button: HTMLButtonElement;
  /** Bloc du bouton, sous la carte. */
  readonly block: HTMLElement;
  /** Image de la carte (haut de la face), où poser notre bouton. */
  readonly imageArea: HTMLElement;
}

/** « Signaler l'image » sous la carte de l'enchère. */
export function findAuctionReport(doc: Document = document): AuctionReport | undefined {
  for (const button of doc.querySelectorAll<HTMLButtonElement>('main button')) {
    if (!hasIcon(button, 'flag') && !/Signaler l.image|Image signalée/i.test(textOf(button))) continue;
    const block = button.parentElement;
    const face = [...(block?.parentElement?.children ?? [])].find((child) => child.matches(FACE) && child.querySelector('h3'));
    const imageArea = face && findFaceImage(face);
    if (block && imageArea) return { button, block, imageArea };
  }
  return undefined;
}
