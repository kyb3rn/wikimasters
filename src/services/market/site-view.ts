import type { Sale } from '@/site/api';
import { parseRarity, RARITIES, type Rarity } from '@/site/rarity';

/*
 * Vue du marché du site, recopiée de son code (historique des ventes, 02/10/2026) : choix des raretés, chiffres et
 * repère de son graphique (Recharts), sans DOM.
 */

const DAY = 86_400_000;

/** Ordre de ses pastilles : de la plus basse rareté à la plus haute. */
const SITE_ORDER: readonly Rarity[] = [...RARITIES].reverse();

/** Toutes les raretés (« Toutes »), ou une seule. */
export type SiteSelection = Rarity | 'any';

/** Raretés qui ont des ventes, dans l'ordre de ses pastilles. */
export function siteRarities(sales: readonly Sale[]): Rarity[] {
  const present = new Set(sales.map((sale) => parseRarity(sale.rarity)));
  return SITE_ORDER.filter((rarity) => present.has(rarity));
}

/**
 * Ventes affichées : le choix précédent tant qu'il reste possible (« Toutes » demande plusieurs raretés), sinon
 * « Toutes » s'il y a plusieurs raretés, la seule sinon ; aucune vente : rien.
 */
export function siteSelection(rarities: readonly Rarity[], previous: SiteSelection | undefined): SiteSelection | undefined {
  const [only] = rarities;
  if (!only) return undefined;
  if (previous === 'any' && rarities.length > 1) return 'any';
  if (previous && previous !== 'any' && rarities.includes(previous)) return previous;
  return rarities.length > 1 ? 'any' : only;
}

/** Ventes du choix, de la plus ancienne à la plus récente. */
export function siteSales(sales: readonly Sale[], selection: SiteSelection | undefined): Sale[] {
  if (!selection) return [];
  const chosen = selection === 'any' ? [...sales] : sales.filter((sale) => parseRarity(sale.rarity) === selection);
  return chosen.sort((a, b) => a.time - b.time);
}

/** Ses « 10 dernières ventes », la plus récente d'abord. */
export const lastSales = (sales: readonly Sale[]): Sale[] => [...sales].sort((a, b) => b.time - a.time).slice(0, 10);

export interface SiteStats {
  readonly count: number;
  /** Moyenne arrondie à l'unité. */
  readonly average: number;
  readonly min: number;
  readonly max: number;
  /** Prix de la vente la plus récente. */
  readonly latest: number;
}

/** Tuiles Ventes, Dernier, Moyenne, Min, Max ; `sales` de la plus ancienne à la plus récente. */
export function siteStats(sales: readonly Sale[]): SiteStats | undefined {
  const prices = sales.map((sale) => sale.price);
  const latest = prices.at(-1);
  if (latest === undefined) return undefined;
  return {
    count: prices.length,
    average: Math.round(prices.reduce((sum, price) => sum + price, 0) / prices.length),
    min: Math.min(...prices),
    max: Math.max(...prices),
    latest,
  };
}

export interface SiteChart {
  /** Dates (ms) aux bords gauche et droit du tracé. */
  readonly t0: number;
  readonly t1: number;
  /** Prix aux bords bas et haut du tracé. */
  readonly p0: number;
  readonly p1: number;
  /** Durée couverte par les ventes : elle choisit le format des dates. */
  readonly spanMs: number;
  readonly priceTicks: readonly number[];
}

/**
 * Repère du graphique : 6 % de la durée de part et d'autre (un jour si toutes les ventes ont la même date), 12 % de
 * l'écart des prix au-dessus et au-dessous (15 % du prix s'il n'y en a qu'un), jamais sous zéro.
 */
export function siteChart(sales: readonly Sale[]): SiteChart | undefined {
  if (sales.length === 0) return undefined;
  const times = sales.map((sale) => sale.time);
  const prices = sales.map((sale) => sale.price);
  const first = Math.min(...times);
  const span = Math.max(...times) - first;
  const timePad = span === 0 ? DAY : 0.06 * span;
  const min = Math.min(...prices);
  const max = Math.max(...prices);
  const pricePad = max === min ? Math.max(1, Math.round(0.15 * min)) : 0.12 * (max - min);
  const p0 = Math.max(0, Math.floor(min - pricePad));
  const p1 = Math.ceil(max + pricePad);
  return {
    t0: first - timePad,
    t1: first + span + timePad,
    p0,
    p1,
    spanMs: span || 2 * timePad,
    priceTicks: fixedDomainTicks(p0, p1),
  };
}

/**
 * Graduations des prix de Recharts sur un intervalle imposé (`getTickValuesFixedDomain`, 5 graduations demandées,
 * sans décimales) : un pas « rond », de `min` jusqu'à un pas avant `max`, puis `max` lui-même (« 0, 2 000, 4 000, 6 719 »).
 */
export function fixedDomainTicks(min: number, max: number, count = 5): number[] {
  if (min === max) return [min];
  const rough = (max - min) / (Math.max(count, 2) - 1);
  const digits = Math.floor(Math.log10(rough)) + 1;
  // Pas arrondi au vingtième de la puissance de dix supérieure (au dixième pour un pas d'un chiffre).
  const quantum = digits === 1 ? 1 : 10 ** digits / 20;
  const step = Math.ceil(Math.ceil(rough / quantum) * quantum);
  const ticks: number[] = [];
  for (let value = min; value < max - 0.99 * step; value += step) ticks.push(value);
  ticks.push(max);
  return ticks;
}

export interface AxisTick {
  readonly coordinate: number;
  /** Largeur (ou hauteur) du libellé. */
  readonly size: number;
}

/**
 * Graduations que Recharts affiche (`interval="preserveEnd"`) : de la dernière à la première, chacune gardée si son
 * libellé tient dans l'axe sans approcher de moins de `gap` la dernière gardée ; la dernière rentre dans l'axe si elle
 * déborde. Coordonnées croissantes ; rend l'indice et la position du libellé de chaque graduation gardée.
 */
export function preserveEnd(
  ticks: readonly AxisTick[],
  start: number,
  end: number,
  gap: number,
): { readonly index: number; readonly at: number }[] {
  const shown: { index: number; at: number }[] = [];
  let limit = end;
  for (let index = ticks.length - 1; index >= 0; index--) {
    const tick = ticks[index];
    if (!tick) continue;
    const overflow = index === ticks.length - 1 ? tick.coordinate + tick.size / 2 - end : 0;
    const at = overflow > 0 ? tick.coordinate - overflow : tick.coordinate;
    if (at - tick.size / 2 >= start && at + tick.size / 2 <= limit) {
      shown.unshift({ index, at });
      limit = at - tick.size / 2 - gap;
    }
  }
  return shown;
}

/** Dates de l'axe : jour et heure sur deux jours au plus, jour jusqu'à 120 jours, mois et année au-delà. */
export function dateTickLabel(time: number, spanMs: number): string {
  const date = new Date(time);
  if (spanMs <= 2 * DAY) return date.toLocaleString('fr-FR', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });
  if (spanMs <= 120 * DAY) return date.toLocaleDateString('fr-FR', { day: '2-digit', month: 'short' });
  return date.toLocaleDateString('fr-FR', { month: 'short', year: '2-digit' });
}

/** Date de l'info-bulle : « mar. 29 septembre 2026 à 00:31 ». */
export const tooltipDate = (time: number): string =>
  new Date(time).toLocaleString('fr-FR', {
    weekday: 'short',
    day: '2-digit',
    month: 'long',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });

/** Date d'une ligne des dernières ventes : « 29 sept. 2026, 00:31 ». */
export const saleDate = (time: number): string =>
  new Date(time).toLocaleString('fr-FR', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });

/**
 * Coin de l'info-bulle de Recharts sur un axe : 10 px après le point visé, ou avant s'il déborderait du tracé, sans
 * dépasser son bord de départ (`getTooltipTranslateXY`).
 */
export function tooltipOffset(target: number, size: number, start: number, length: number): number {
  const after = target + 10;
  return after + size > start + length ? Math.max(target - size - 10, start) : Math.max(after, start);
}
