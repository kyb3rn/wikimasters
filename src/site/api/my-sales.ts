import { isRecord } from '@/core/guards';
import { parseRarity, type Rarity } from '@/site/rarity';
import { siteRequest } from './request';

/**
 * Une de mes ventes en cours au marché : l'annonce et l'exemplaire mis en vente, aux valeurs de l'exemplaire (rareté,
 * ATK, DEF de l'annonce). Liste `selling` de `GET /api/marketplace?…&mine=1` (capture du 02/10/2026) : annonces
 * `active` du joueur, 10 au plus (compte PRO), `card` jointe.
 */
export interface MarketListing {
  /** Annonce (`/marketplace/<id>`). */
  readonly id: string;
  readonly cardId: string;
  readonly title: string;
  readonly category: string;
  /** Absente si la carte cache son image. */
  readonly image: string | undefined;
  readonly rarity: Rarity;
  readonly shiny: boolean;
  readonly atk: number;
  readonly def: number;
  /** Mise actuelle, sinon de départ. */
  readonly amount: number;
  /** Quelqu'un a misé. */
  readonly hasBid: boolean;
  /** Fin de l'enchère (ms). */
  readonly endAt: number;
  /** Mise en vente (ms) ; illisible : 0. */
  readonly obtainedAt: number;
}

const number = (...values: unknown[]): number | undefined => {
  for (const value of values) if (typeof value === 'number' && Number.isFinite(value)) return value;
  return undefined;
};

export function parseMarketListing(raw: unknown): MarketListing | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || !isRecord(raw.card) || typeof raw.end_at !== 'string') return undefined;
  const { card } = raw;
  const cardId = typeof raw.card_id === 'string' ? raw.card_id : card.id;
  const rarity = parseRarity(raw.snapshot_rarity) ?? parseRarity(card.rarity);
  const amount = number(raw.effective_bid, raw.current_bid, raw.base_amount);
  const endAt = Date.parse(raw.end_at);
  if (typeof cardId !== 'string' || typeof card.wikipedia_title !== 'string' || !rarity || amount === undefined || !Number.isFinite(endAt)) {
    return undefined;
  }
  const createdAt = typeof raw.created_at === 'string' ? Date.parse(raw.created_at) : NaN;
  return {
    id: raw.id,
    cardId,
    title: card.wikipedia_title.trim(),
    category: typeof card.category === 'string' ? card.category : '',
    image: card.hide_image !== true && typeof card.image_url === 'string' && card.image_url !== '' ? card.image_url : undefined,
    rarity,
    shiny: raw.is_shiny === true && rarity === 'L',
    atk: number(raw.snapshot_atk, card.atk) ?? 0,
    def: number(raw.snapshot_def, card.def) ?? 0,
    amount,
    hasBid: raw.current_bid !== null && raw.current_bid !== undefined,
    endAt,
    obtainedAt: Number.isFinite(createdAt) ? createdAt : 0,
  };
}

/** Réponse de `mine=1` : ses ventes en cours (annonces illisibles laissées de côté). */
export function parseMySales(raw: unknown): MarketListing[] | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.selling)) return undefined;
  return raw.selling.flatMap((item) => (isRecord(item) && item.status !== 'active' ? [] : (parseMarketListing(item) ?? [])));
}

/**
 * Mes ventes en cours, comme le site relit ses listes personnelles du marché (`page=1&limit=1&mine=1`). Une
 * tentative.
 */
export function fetchMySales(): Promise<MarketListing[]> {
  return siteRequest('/api/marketplace?page=1&limit=1&mine=1', {}, parseMySales);
}
