import { isRecord } from '@/core/guards';
import { currentFiberAncestors } from '@/core/react';
import { textOf } from '@/core/text';
import { FACE, findFaceImage } from '@/site/cards';

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
 * Fin de l'enchère d'une vignette du site (`end_at`, en millisecondes), lue dans les props de son composant (l'annonce
 * entière, de même `id`), au dernier rendu : elle peut être repoussée par une mise de dernière minute.
 */
export function readTileEndAt({ tile, auctionId }: SiteAuctionTile): number | undefined {
  for (const fiber of currentFiberAncestors(tile).slice(0, 8)) {
    const props: unknown = fiber.memoizedProps;
    if (!isRecord(props)) continue;
    for (const value of [props, ...Object.values(props)]) {
      if (!isRecord(value) || value.id !== auctionId || typeof value.end_at !== 'string') continue;
      const endAt = Date.parse(value.end_at);
      if (Number.isFinite(endAt)) return endAt;
    }
  }
  return undefined;
}
