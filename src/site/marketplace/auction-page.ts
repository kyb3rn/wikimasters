import { isRecord } from '@/core/guards';
import { currentFiberAncestors, stateHooks } from '@/core/react';
import { textOf } from '@/core/text';
import { isAuctionStatus, parseListingCard, type AuctionStatus } from '@/site/api';
import { FACE, findFaceImage, type CardRef } from '@/site/cards';
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
 *       div.card-frame : « Votre solde », « Mise minimum : n », champ (Diminuer · input · Augmenter), « Miser » (en cours, pas le vendeur)
 *       …
 *       div.card-frame.p-4.text-sm « Remportée par <span>pseudo</span> pour <span>n</span> wikibidous. » (vendue ; code du site, 30/09/2026)
 *   div.space-y-3 : h2 « Historique des mises (n) », ul.card-frame > li > span pseudo (« Joueur » sans pseudo), span (date, montant)
 *
 * Le meneur et l'historique changent en direct (mises reçues en temps réel).
 */

/** Bouton « Vue du marché », à côté du titre de la carte (icône lucide `chart-line`), dans `div.flex.items-start.gap-2`. */
export const AUCTION_MARKET_BUTTON = 'main button[aria-label="Vue du marché"]';

/** Canal temps réel de l'enchère (mises reçues, sans `realtime:`), rejoint par sa page. */
export const auctionChannel = (auctionId: string) => `auction:${auctionId}`;

/**
 * Champ du montant de la mise (`min` : la mise minimum), entre ses boutons « Diminuer » et « Augmenter », frères dans
 * le même conteneur. Le site y réécrit sa mise minimum à chaque mise reçue, relecture de l'enchère et mise placée.
 */
export const AUCTION_BID_INPUT = 'main input[aria-label="Montant de la mise"]';

export interface AuctionPlayer {
  /** `span` du pseudo, rendu par le site. */
  readonly name: HTMLElement;
  readonly username: string;
  /** Le vendeur (« Mis en vente par »). */
  readonly seller: boolean;
}

/** Pseudo tel quel, espaces compris. */
const usernameOf = (name: Element) => (name.textContent ?? '').trim();

/** Joueur d'une ligne de l'historique dont le site n'a pas le pseudo. */
const NO_USERNAME = 'Joueur';

/** Vendeur (« Mis en vente par »), meneur (« Meneur : »), gagnant (« Remportée par ») et joueurs de l'historique des mises. */
export function findAuctionPlayers(doc: Document = document): AuctionPlayer[] {
  const names: HTMLElement[] = [];
  let seller: HTMLElement | undefined;
  for (const line of doc.querySelectorAll<HTMLElement>('main p')) {
    const role = /^(Mis en vente par|Meneur :)/.exec(textOf(line))?.[1];
    if (!role) continue;
    const name = line.querySelector<HTMLElement>(':scope > span');
    if (!name) continue;
    names.push(name);
    if (role === 'Mis en vente par') seller = name;
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
  return names.map((name) => ({ name, username: usernameOf(name), seller: name === seller })).filter((player) => player.username !== '');
}

/** Carte de l'enchère, en tête de la colonne de gauche. */
export function findAuctionFace(doc: Document = document): HTMLElement | undefined {
  return [...doc.querySelectorAll<HTMLElement>(`main div.flex-shrink-0 > ${FACE}`)].find((face) => face.querySelector('h3'));
}

/**
 * L'enchère affichée, lue dans l'état de sa page (l'annonce entière, même `id`) depuis un de ses nœuds : celle qu'elle
 * affiche, même si le script a démarré après sa requête, et à jour de chaque relecture (code du site, 01/10/2026).
 */
function readAuctionState<T>(from: Element, auctionId: string, read: (auction: Record<string, unknown>) => T | undefined): T | undefined {
  for (const fiber of currentFiberAncestors(from)) {
    for (const { value } of stateHooks(fiber)) {
      const result = isRecord(value) && value.id === auctionId ? read(value) : undefined;
      if (result !== undefined) return result;
    }
  }
  return undefined;
}

export function readAuctionStatus(face: Element, auctionId: string): AuctionStatus | undefined {
  return readAuctionState(face, auctionId, (auction) => (isAuctionStatus(auction.status) ? auction.status : undefined));
}

/** Carte de l'enchère affichée (rareté de l'exemplaire en vente). */
export function readAuctionCard(from: Element, auctionId: string): CardRef | undefined {
  return readAuctionState(from, auctionId, parseListingCard);
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
