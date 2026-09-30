import type { MarketCard, MarketEntry } from '@/services/market';
import type { Sale } from '@/site/api';

const DAY = 24 * 60 * 60 * 1000;

/** Carte inventée : « Actualiser » de son historique demande ses ventes au site, qui ne la connaît pas (erreur en toast). */
export const DEMO_CARD: MarketCard = { id: 'wm-vitrine', title: 'Tour Eiffel', rarity: 'SR' };

/** Nombres pseudo-aléatoires à graine (mulberry32) : la vitrine montre les mêmes ventes à chaque chargement. */
export function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const BASE_PRICE: Readonly<Record<string, number>> = { R: 90, SR: 240, UR: 700 };
/** Raretés des ventes, surtout celle de la carte. */
const RARITY_MIX = ['SR', 'SR', 'SR', 'R', 'R', 'UR'];

export interface DemoSalesOptions {
  readonly count?: number;
  readonly days?: number;
  readonly seed?: number;
}

/** Ventes inventées sur les `days` derniers jours, du plus ancien au plus récent : prix de la rareté suivant une tendance. */
export function demoSales(now: number, { count = 140, days = 90, seed = 7 }: DemoSalesOptions = {}): Sale[] {
  const random = seededRandom(seed);
  const times = Array.from({ length: count }, () => Math.round(now - random() * days * DAY)).sort((a, b) => a - b);
  let trend = 1;
  return times.map((time, index) => {
    trend = Math.min(1.6, Math.max(0.6, trend + (random() - 0.48) * 0.06));
    const rarity = RARITY_MIX[Math.floor(random() * RARITY_MIX.length)] ?? 'SR';
    const price = Math.round((BASE_PRICE[rarity] ?? 100) * trend * (0.8 + random() * 0.4));
    return { id: `vente-${index + 1}`, price, time, rarity };
  });
}

/** Historique de la carte inventée, chargé il y a 5 minutes. */
export function demoEntry(now: number): MarketEntry {
  return { cardId: DEMO_CARD.id, title: DEMO_CARD.title, fetchedAt: now - 5 * 60 * 1000, sales: demoSales(now) };
}
