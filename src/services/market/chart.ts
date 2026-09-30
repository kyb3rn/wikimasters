import type { Sale } from '@/site/api';
import { movingAverage, niceStep, type AveragePoint } from './stats';

/**
 * Modèle du graphique des ventes, sans DOM. Abscisse `u` = date de la vente (ms), ou son rang si toutes
 * les ventes ont la même date ; ordonnée = prix. La vue (`View`) est la fenêtre affichée de ce repère.
 */

const DAY = 86_400_000;

export interface View {
  readonly u0: number;
  readonly u1: number;
  readonly p0: number;
  readonly p1: number;
}

/** Zone du SVG : marges autour du tracé (graduations des prix à gauche, des dates en bas). */
export interface Geometry {
  readonly width: number;
  readonly height: number;
  readonly left: number;
  readonly right: number;
  readonly top: number;
  readonly bottom: number;
  readonly innerWidth: number;
  readonly innerHeight: number;
}

export function geometry(width: number, height: number): Geometry {
  const left = width > 400 ? 44 : 34;
  const right = 10;
  const top = 10;
  const bottom = 20;
  return { width, height, left, right, top, bottom, innerWidth: width - left - right, innerHeight: height - top - bottom };
}

export const xOf = (geo: Geometry, view: View, u: number) => geo.left + ((u - view.u0) / (view.u1 - view.u0)) * geo.innerWidth;
export const yOf = (geo: Geometry, view: View, p: number) =>
  geo.top + (1 - (p - view.p0) / (view.p1 - view.p0)) * geo.innerHeight;
export const uOfX = (geo: Geometry, view: View, x: number) => view.u0 + ((x - geo.left) / geo.innerWidth) * (view.u1 - view.u0);
export const pOfY = (geo: Geometry, view: View, y: number) =>
  view.p0 + (1 - (y - geo.top) / geo.innerHeight) * (view.p1 - view.p0);

export interface ChartPoint {
  readonly u: number;
  readonly time: number;
  readonly price: number;
  readonly rarity: string;
}

export interface AverageLine {
  /** Fenêtre (nombre de ventes). */
  readonly n: number;
  readonly color: string;
  readonly points: readonly (AveragePoint & { readonly u: number })[];
  /**
   * Début de courbe, fenêtre partielle : un segment pointillé par pas, de plus en plus opaque, jusqu'au
   * premier point à fenêtre complète. La suite est tracée en trait plein.
   */
  readonly partial: readonly { readonly from: number; readonly to: number; readonly opacity: number }[];
}

export interface ChartModel {
  readonly points: readonly ChartPoint[];
  /** Toutes les ventes à la même date : abscisse = rang. */
  readonly byIndex: boolean;
  /** Étendue des ventes. */
  readonly data: View;
  /** Butées du déplacement : dates des ventes × prix de 0 au maximum. */
  readonly world: View;
  /**
   * Vue de départ (touche R) : les 30 derniers jours et 5 % de marge à droite, prix ajustés aux ventes de
   * cette fenêtre, 4 % de marge en bas (la vente la plus basse ne touche pas le bord). Sans vente depuis
   * 30 jours : toutes les ventes.
   */
  readonly initial: View;
  /** Toutes les ventes (touche A), mêmes marges. */
  readonly all: View;
  readonly averages: readonly AverageLine[];
}

export interface AverageWindow {
  readonly n: number;
  readonly color: string;
}

/** Au moins deux ventes, sinon `undefined`. `sales` : du plus ancien au plus récent. */
export function chartModel(sales: readonly Sale[], windows: readonly AverageWindow[], now = Date.now()): ChartModel | undefined {
  if (sales.length < 2) return undefined;
  const times = sales.map((sale) => sale.time);
  const prices = sales.map((sale) => sale.price);
  const tmin = Math.min(...times);
  const tmax = Math.max(...times);
  const pmin = Math.min(...prices);
  const pmax = Math.max(...prices);
  const byIndex = tmax - tmin <= 0;
  const points = sales.map((sale, index) => ({ u: byIndex ? index : sale.time, time: sale.time, price: sale.price, rarity: sale.rarity }));

  const data: View = {
    u0: byIndex ? 0 : tmin,
    u1: byIndex ? points.length - 1 : tmax,
    p0: pmax > pmin ? pmin : pmin - 1,
    p1: pmax > pmin ? pmax : pmax + 1,
  };
  const world: View = { ...data, p0: Math.min(0, data.p0) };

  /** Dates de `from` à `to` (+5 % à droite), prix ajustés aux ventes qui s'y trouvent (−4 % en bas). */
  const frame = (from: number, to: number): View => {
    const u1 = to + 0.05 * (to - from);
    let { p0, p1 } = data;
    const visible = points.filter((point) => point.u >= from && point.u <= u1).map((point) => point.price);
    if (visible.length) {
      p0 = Math.min(...visible);
      p1 = Math.max(...visible);
      if (p1 - p0 <= 0) {
        p0 -= 1;
        p1 += 1;
      }
    }
    return { u0: from, u1, p0: p0 - 0.04 * (p1 - p0), p1 };
  };
  const all = frame(data.u0, data.u1);
  const recent = !byIndex && times.some((time) => time >= now - 30 * DAY && time <= now + DAY);
  const initial = recent ? frame(now - 30 * DAY, now) : all;

  const averages = windows.flatMap(({ n, color }): AverageLine[] => {
    const series = movingAverage(prices, n).map((point) => ({ ...point, u: points[point.index]?.u ?? 0 }));
    const first = series[0];
    if (!first || series.length < 2) return [];
    const partial: AverageLine['partial'][number][] = [];
    for (let j = 1; j < series.length && !series[j - 1]?.full; j++) {
      const count = series[j]?.count ?? n;
      partial.push({ from: j - 1, to: j, opacity: 0.25 + (0.65 * (count - first.count)) / Math.max(1, n - first.count) });
    }
    return [{ n, color, points: series, partial }];
  });

  return { points, byIndex, data, world, initial, all, averages };
}

/**
 * Vue bornée : zoom avant jusqu'à 1/200 de l'étendue des ventes, arrière jusqu'à 4 fois la plus grande des
 * étendues (ventes, vues de départ et d'ensemble ; pour les prix, de 0 au maximum). Toujours en contact avec le « monde » :
 * on peut descendre sous zéro jusqu'à amener l'axe du prix 0 en haut du tracé, pas au-delà.
 */
export function clampView(model: ChartModel, view: View): View {
  const { data, world, initial, all } = model;
  const uIn = data.u1 - data.u0;
  const uOut = Math.max(uIn, initial.u1 - initial.u0, all.u1 - all.u0);
  const pIn = data.p1 - data.p0;
  const pOut = Math.max(world.p1 - world.p0, initial.p1 - initial.p0, all.p1 - all.p0);
  const uSpan = Math.min(uOut * 4, Math.max(uIn / 200, view.u1 - view.u0));
  const pSpan = Math.min(pOut * 4, Math.max(pIn / 200, view.p1 - view.p0));
  const uc = (view.u0 + view.u1) / 2;
  const pc = (view.p0 + view.p1) / 2;
  let u0 = uc - uSpan / 2;
  let u1 = uc + uSpan / 2;
  let p0 = pc - pSpan / 2;
  let p1 = pc + pSpan / 2;
  if (u0 > world.u1) [u0, u1] = [world.u1, u1 - (u0 - world.u1)];
  if (u1 < world.u0) [u0, u1] = [u0 + (world.u0 - u1), world.u0];
  if (p0 > world.p1) [p0, p1] = [world.p1, p1 - (p0 - world.p1)];
  if (p1 < world.p0) [p0, p1] = [p0 + (world.p0 - p1), world.p0];
  return { u0, u1, p0, p1 };
}

/** Zoom de facteur `k` (< 1 : avant) autour de `anchor`, sur les dates ou sur les prix. */
export function zoomDates(view: View, anchor: number, k: number): View {
  return { ...view, u0: anchor - (anchor - view.u0) * k, u1: anchor + (view.u1 - anchor) * k };
}

export function zoomPrices(view: View, anchor: number, k: number): View {
  return { ...view, p0: anchor - (anchor - view.p0) * k, p1: anchor + (view.p1 - anchor) * k };
}

/** Graduations de prix « jolies » sur la vue (négatives si la vue descend sous zéro). */
export function priceTicks(view: View, count: number): number[] {
  const step = niceStep(view.p1 - view.p0, count);
  const ticks: number[] = [];
  for (let k = Math.ceil(view.p0 / step - 1e-9); k * step <= view.p1 + 1e-9; k++) ticks.push(k * step || 0);
  return ticks;
}

/** `count` dates réparties sur la vue, bornes comprises. */
export function dateTicks(view: View, count: number): number[] {
  return Array.from({ length: count }, (_, index) => view.u0 + ((view.u1 - view.u0) * index) / Math.max(1, count - 1));
}

/** Libellé d'une graduation de date : année sur plus de 300 jours, heure sous 2 jours. */
export function dateTickLabel(time: number, span: number): string {
  const date = new Date(time);
  const day = date.toLocaleDateString(
    'fr-FR',
    span > 300 * DAY ? { day: '2-digit', month: '2-digit', year: '2-digit' } : { day: '2-digit', month: '2-digit' },
  );
  return span < 2 * DAY ? `${day} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}` : day;
}

/** Date sous le curseur (info-bulle des moyennes) : heure en plus quand la vue couvre moins de 2 jours. */
export function cursorDateLabel(model: ChartModel, view: View, u: number): string {
  const date = new Date(model.byIndex ? (model.points[0]?.time ?? u) : u);
  const day = date.toLocaleDateString('fr-FR');
  return !model.byIndex && view.u1 - view.u0 < 2 * DAY
    ? `${day} ${date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : day;
}
