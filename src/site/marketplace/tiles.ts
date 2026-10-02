import { isRecord } from '@/core/guards';
import { currentFiberAncestors } from '@/core/react';
import { textOf } from '@/core/text';
import { isAuctionStatus, parseListingCard, type AuctionStatus } from '@/site/api';
import { FACE, findFaceImage, type CardRef } from '@/site/cards';
import { parseRarity } from '@/site/rarity';

/**
 * Vignettes d'annonce du marché, dans tous les onglets (captures du 29/09/2026) :
 *
 *   div#marketplace-auction-<id>                         case de la grille
 *     a.card-frame.block.p-3.w-[172px].md:w-[184px][href="/marketplace/<id>"]
 *       div.flex.flex-col.items-center.gap-2.5
 *         span « Vous menez » / « Surenchéri »            (Mes enchères seulement)
 *         div.overflow-hidden.rounded-2xl > face          (taille `sm`)
 *         div.w-full.flex.justify-between                 libellé du prix et montant · « Durée » et compte à rebours
 *         p.w-full.truncate                               « Vendu par <pseudo> » (pseudo tel quel, espaces compris)
 */
/**
 * Nos vignettes faites comme les siennes, même balisage (recherche avancée, en dev) : elles reçoivent le même
 * habillage (marketplace-tiles, player-links), sans doubler l'`id` d'une vignette du site.
 */
export const OWN_TILE = 'wm-auction-tile';
/** Notre temps restant (carte standardisée du marché), dans la colonne de la durée, à la place du compte à rebours. */
export const OWN_TIME = 'wm-auction-time';
const SITE_TILE = 'div[id^="marketplace-auction-"]';
const SITE_TILE_PREFIX = 'marketplace-auction-';
export const TILE = `:is(${SITE_TILE}, div.${OWN_TILE})`;
export const TILE_LINK = `${TILE} > a.card-frame`;
export const TILE_FACE = `${TILE_LINK} > div > div.overflow-hidden`;
/** Compte à rebours du site (« 9m 38s », ambre sous 5 min, « Terminée » à zéro), calculé sur l'horloge du PC. */
const TILE_DURATION = `${TILE_LINK} > div > div.w-full > div:last-child > span:last-child:not(.${OWN_TIME})`;

const SELLER_PREFIX = /^Vendu par\s+/;
const ENDED = 'Terminée';

export interface MarketplaceSeller {
  /** « Vendu par <pseudo> » du site. */
  readonly line: HTMLElement;
  readonly username: string;
  /** Image de la carte de la vignette. */
  readonly image: HTMLElement | undefined;
}

/** « Vendu par … » de chaque vignette affichée. */
export function findMarketplaceSellers(root: ParentNode = document): MarketplaceSeller[] {
  const sellers: MarketplaceSeller[] = [];
  for (const line of root.querySelectorAll<HTMLElement>(`${TILE_LINK} > div > p`)) {
    // Pseudo tel quel, espaces compris.
    const text = (line.textContent ?? '').trim();
    if (!SELLER_PREFIX.test(text)) continue;
    const username = text.replace(SELLER_PREFIX, '');
    const face = line.closest(TILE)?.querySelector(`${TILE_FACE} > ${FACE}`);
    if (username) sellers.push({ line, username, image: face ? findFaceImage(face) : undefined });
  }
  return sellers;
}

/** Comptes à rebours des vignettes affichées, et s'ils sont arrivés à zéro. */
export function findTileDurations(root: ParentNode = document): { readonly element: HTMLElement; readonly ended: boolean }[] {
  return [...root.querySelectorAll<HTMLElement>(TILE_DURATION)].map((element) => ({
    element,
    ended: textOf(element) === ENDED,
  }));
}

export interface AuctionTileFace {
  readonly tile: HTMLElement;
  readonly face: HTMLElement;
  /** Vignette du script (recherche avancée), hors des onglets du site. */
  readonly own: boolean;
}

/** Face de chaque vignette affichée, celles du site comme les nôtres. */
export function findAuctionTileFaces(root: ParentNode = document): AuctionTileFace[] {
  return [...root.querySelectorAll<HTMLElement>(`${TILE_FACE} > ${FACE}`)].flatMap((face) => {
    const tile = face.closest<HTMLElement>(TILE);
    return tile ? [{ tile, face, own: tile.classList.contains(OWN_TILE) }] : [];
  });
}

export interface SiteAuctionTile {
  readonly tile: HTMLElement;
  readonly auctionId: string;
  /** Compte à rebours du site. */
  readonly countdown: HTMLElement;
}

/** Vignettes du site affichées (pas les nôtres), avec leur compte à rebours. */
export function findSiteAuctionTiles(root: ParentNode = document): SiteAuctionTile[] {
  const tiles: SiteAuctionTile[] = [];
  for (const tile of root.querySelectorAll<HTMLElement>(SITE_TILE)) {
    const countdown = tile.querySelector<HTMLElement>(`:scope > a.card-frame > div > div.w-full > div:last-child > span:last-child`);
    if (countdown) tiles.push({ tile, auctionId: tile.id.slice(SITE_TILE_PREFIX.length), countdown });
  }
  return tiles;
}

/**
 * L'annonce entière (de même `id`), au dernier rendu. Le site la passe au composant de la vignette, rendu dans la
 * case : `div#marketplace-auction-<id>` › composant `{ auction, href, bidStatus, owned, onBeforeNavigate, userId }`
 * (code du site, 01/10/2026). Ses props sont donc sur l'enfant de la case, pas sur un ancêtre.
 */
function tileListing(tile: HTMLElement, auctionId: string): Record<string, unknown> | undefined {
  const fibers = currentFiberAncestors(tile).slice(0, 8);
  for (const fiber of [fibers[0]?.child, ...fibers]) {
    const props: unknown = fiber?.memoizedProps;
    if (!isRecord(props)) continue;
    for (const value of [props, ...Object.values(props)]) {
      if (isRecord(value) && value.id === auctionId) return value;
    }
  }
  return undefined;
}

const dateOf = (value: unknown) => (typeof value === 'string' ? Date.parse(value) : Number.NaN);

/**
 * Fin de l'enchère d'une vignette du site (`end_at`, en millisecondes), lue dans l'annonce au dernier rendu : elle
 * peut être repoussée par une mise de dernière minute.
 */
export function readTileEndAt({ tile, auctionId }: SiteAuctionTile): number | undefined {
  const endAt = dateOf(tileListing(tile, auctionId)?.end_at);
  return Number.isFinite(endAt) ? endAt : undefined;
}

/** Une vignette d'annonce affichée, du site ou à nous (recherche avancée). */
export interface AuctionTile {
  readonly tile: HTMLElement;
  /** Colonne du cadre (`a.card-frame > div`) : carte, mise et durée. */
  readonly column: HTMLElement;
  /** Face de la carte. */
  readonly face: HTMLElement | undefined;
  readonly own: boolean;
}

/** Vignettes d'annonce affichées, celles du site comme les nôtres. */
export function findAuctionTiles(root: ParentNode = document): AuctionTile[] {
  return [...root.querySelectorAll<HTMLElement>(TILE)].flatMap((tile) => {
    const column = tile.querySelector<HTMLElement>(':scope > a.card-frame > div');
    if (!column) return [];
    const face = column.querySelector<HTMLElement>(`:scope > div.overflow-hidden > ${FACE}`) ?? undefined;
    return [{ tile, column, face, own: tile.classList.contains(OWN_TILE) }];
  });
}

export interface TileAuction {
  /** Rareté de l'exemplaire en vente, sinon celle de la carte aujourd'hui. */
  readonly card: CardRef;
  /** Montant affiché : mise actuelle, sinon mise de départ (`effective_bid`). */
  readonly amount: number | undefined;
  readonly status: AuctionStatus | undefined;
}

const amountOf = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) ? value : undefined);

/** Annonce de nos vignettes, en attributs (`ownTileData`) : elles n'ont pas de composant React où la lire. */
const OWN_DATA = {
  cardId: 'data-wm-card-id',
  title: 'data-wm-card-title',
  rarity: 'data-wm-rarity',
  amount: 'data-wm-amount',
  status: 'data-wm-status',
} as const;

/** Attributs à poser sur une de nos vignettes pour que son annonce se lise comme celle des vignettes du site. */
export function ownTileData({ card, amount, status }: TileAuction): Record<string, string | undefined> {
  return {
    [OWN_DATA.cardId]: card.id,
    [OWN_DATA.title]: card.title,
    [OWN_DATA.rarity]: card.rarity,
    [OWN_DATA.amount]: amount === undefined ? undefined : String(amount),
    [OWN_DATA.status]: status,
  };
}

function readOwnTileAuction(tile: HTMLElement): TileAuction | undefined {
  const id = tile.getAttribute(OWN_DATA.cardId);
  if (!id) return undefined;
  const status = tile.getAttribute(OWN_DATA.status);
  const amount = tile.getAttribute(OWN_DATA.amount);
  return {
    card: { id, title: tile.getAttribute(OWN_DATA.title) ?? '', rarity: parseRarity(tile.getAttribute(OWN_DATA.rarity)) },
    amount: amount === null ? undefined : amountOf(Number(amount)),
    status: isAuctionStatus(status) ? status : undefined,
  };
}

/**
 * L'annonce d'une vignette : pour celles du site, les props de son composant au dernier rendu (une mise reçue change
 * le montant) ; pour les nôtres, leurs attributs.
 */
export function readTileAuction({ tile, own }: AuctionTile): TileAuction | undefined {
  if (own) return readOwnTileAuction(tile);
  const listing = tileListing(tile, tile.id.slice(SITE_TILE_PREFIX.length));
  const card = parseListingCard(listing);
  if (!listing || !card) return undefined;
  return {
    card,
    amount: amountOf(listing.effective_bid) ?? amountOf(listing.current_bid) ?? amountOf(listing.base_amount),
    status: isAuctionStatus(listing.status) ? listing.status : undefined,
  };
}
