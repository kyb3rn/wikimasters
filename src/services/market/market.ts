import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { net } from '@/core/net';
import { fetchCardSales, parseCardSales, readSalesRequest, type CardSales } from '@/site/api';
import type { CardRef } from '@/site/cards';
import { proStatus } from '@/site/pro';
import { readEntries, readEntry, writeEntry, type MarketEntry } from './cache';
import { marketSettings } from './settings';

const HOUR = 3_600_000;

const inflight = new Map<string, Promise<MarketEntry>>();
const changes = createListeners<[entry: MarketEntry]>(createLogger('marché'));
let tracking = false;

/**
 * Compte sans PRO : les ventes d'une carte lui sont refusées (erreur de l'API), l'offre PRO s'ouvre à la place.
 * Statut encore inconnu : permis (le site le donne vite ; au pire, l'erreur en toast).
 */
export function marketNeedsPro(): boolean {
  return proStatus() === false;
}

/** Plus vieille que la durée du cache (réglage) : à redemander au site. */
export function isStale(entry: MarketEntry, now = Date.now()): boolean {
  return now - entry.fetchedAt > marketSettings.get('cacheHours') * HOUR;
}

/** Ventes en cache, même anciennes, sans réseau. */
export function cachedMarket(cardId: string): Promise<MarketEntry | undefined> {
  return readEntry(cardId);
}

/** Ventes en cache de plusieurs cartes, même anciennes, sans réseau, en une lecture. */
export function cachedMarkets(cardIds: readonly string[]): Promise<Map<string, MarketEntry>> {
  return readEntries(cardIds);
}

async function store(cardId: string, sales: CardSales, fallbackTitle: string): Promise<MarketEntry> {
  const sorted = [...sales.sales].sort((a, b) => a.time - b.time);
  const entry: MarketEntry = { cardId, title: sales.title || fallbackTitle, fetchedAt: Date.now(), sales: sorted };
  await writeEntry(entry);
  changes.emit(entry);
  return entry;
}

/** Ventes demandées au site, puis mises en cache. Une seule requête à la fois par carte. */
export function fetchMarket(card: CardRef): Promise<MarketEntry> {
  const pending = inflight.get(card.id);
  if (pending) return pending;
  const request = fetchCardSales(card.id)
    .then((sales) => store(card.id, sales, card.title))
    .finally(() => inflight.delete(card.id));
  inflight.set(card.id, request);
  return request;
}

/** Prévenu de chaque chargement de ventes (le nôtre ou celui du site). */
export function onMarketChange(listener: (entry: MarketEntry) => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}

/** Les ventes que le site demande lui-même vont aussi dans le cache (une fois pour tout le script). */
export function trackMarket(): void {
  if (tracking) return;
  tracking = true;
  net.observe(
    (request) => !request.own && readSalesRequest(request) !== undefined,
    async (exchange) => {
      const cardId = readSalesRequest(exchange.request);
      const sales = exchange.ok ? parseCardSales(await exchange.json().catch(() => undefined)) : undefined;
      if (cardId && sales) await store(cardId, sales, '');
    },
  );
}
