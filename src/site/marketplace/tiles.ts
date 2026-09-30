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
export const TILE = 'div[id^="marketplace-auction-"]';
export const TILE_LINK = `${TILE} > a.card-frame`;
export const TILE_FACE = `${TILE_LINK} > div > div.overflow-hidden`;
/** Compte à rebours (« 9m 38s », ambre sous 5 min, « Terminée » à zéro). */
const TILE_DURATION = `${TILE_LINK} > div > div.w-full > div:last-child > span:last-child`;

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
    ended: (element.textContent ?? '').trim() === ENDED,
  }));
}
