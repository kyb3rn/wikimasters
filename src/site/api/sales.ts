import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { siteRequest } from './request';

/**
 * Ventes d'une carte (modèle), toutes raretés mélangées : `GET /api/marketplace/cards/<card_id>/sales`, réponse
 * `{ wikipedia_title, sales: [{ id, final_price, settled_at, rarity }], recent }` (ventes du plus ancien au plus
 * récent, `recent` = les 10 dernières). Sans indication de shiny. `?scope=summary` est une autre réponse
 * (moyennes par rareté, comptes PRO) : pas des ventes.
 */
export interface Sale {
  readonly id: string;
  readonly price: number;
  /** Date de la vente (ms). */
  readonly time: number;
  /** Rareté de l'exemplaire vendu, telle que donnée par le site (`''` si absente). */
  readonly rarity: string;
}

export interface CardSales {
  readonly title: string;
  readonly sales: readonly Sale[];
}

const SALES_PATH = /^\/api\/marketplace\/cards\/([^/]+)\/sales$/;

/** Une vente du site (`{ id, final_price, settled_at, rarity }`), `undefined` si elle est illisible. */
export function parseSale(raw: unknown): Sale | undefined {
  if (!isRecord(raw)) return undefined;
  const price = typeof raw.final_price === 'number' ? raw.final_price : Number(raw.final_price);
  const time = typeof raw.settled_at === 'string' ? Date.parse(raw.settled_at) : Number.NaN;
  if (!Number.isFinite(price) || !Number.isFinite(time)) return undefined;
  return {
    id: typeof raw.id === 'string' ? raw.id : '',
    price,
    time,
    rarity: typeof raw.rarity === 'string' ? raw.rarity.trim().toUpperCase() : '',
  };
}

export function parseCardSales(raw: unknown): CardSales | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.sales)) return undefined;
  return {
    title: typeof raw.wikipedia_title === 'string' ? raw.wikipedia_title : '',
    sales: raw.sales.flatMap((sale) => parseSale(sale) ?? []),
  };
}

/** Carte dont une requête demande les ventes (pas le résumé `scope=summary`). */
export function readSalesRequest(request: NetRequest): string | undefined {
  if (request.method !== 'GET' || request.url.searchParams.has('scope')) return undefined;
  const cardId = SALES_PATH.exec(request.url.pathname)?.[1];
  return cardId ? decodeURIComponent(cardId) : undefined;
}

export function fetchCardSales(cardId: string): Promise<CardSales> {
  return siteRequest(`/api/marketplace/cards/${encodeURIComponent(cardId)}/sales`, { method: 'GET' }, parseCardSales);
}
