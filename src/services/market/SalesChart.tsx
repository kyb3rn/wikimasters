import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { parseRarity, rarityColor } from '@/site/rarity';
import {
  clampView,
  cursorDateLabel,
  dateTickLabel,
  dateTicks,
  geometry,
  pOfY,
  priceTicks,
  uOfX,
  xOf,
  yOf,
  zoomDates,
  zoomPrices,
  type AverageWindow,
  type ChartModel,
  type View,
} from './chart';
import { Coin } from './Coin';
import { formatDate, formatNumber, formatTime, round1, shortDate } from './format';
import { marketSettings } from './settings';

export const AVERAGE_WINDOWS: readonly AverageWindow[] = [
  { n: 5, color: '#58a6ff' },
  { n: 12, color: '#ff7b72' },
];

const GEO = geometry(820, 300);
const RADIUS = 3.4;
const PRICE_TICKS = 5;
const DATE_TICKS = 5;
/** Distance (px écran) au-delà de laquelle aucun point n'est survolé. */
const HOVER_PX = 16;
/** Glisser de 150 unités SVG sur un axe = zoom d'un facteur e. */
const DRAG_ZOOM = 150;

type Zone = 'plot' | 'dates' | 'prices';

type Hover =
  | { readonly kind: 'point'; readonly index: number }
  | { readonly kind: 'averages'; readonly x: number; readonly values: readonly ({ readonly price: number; readonly y: number } | undefined)[] }
  | { readonly kind: 'rule'; readonly y: number; readonly price: number };

interface Tip {
  readonly content: ComponentChildren;
  /** Point d'ancrage (coordonnées écran). */
  readonly x: number;
  readonly y: number;
}

interface Drag {
  readonly zone: Zone;
  readonly startX: number;
  readonly startY: number;
  /** Point de départ dans le SVG : les zooms sont ancrés sur la valeur qui s'y trouvait. */
  readonly anchorX: number;
  readonly anchorY: number;
  readonly view: View;
  moved: boolean;
}

interface Keys {
  readonly shift: boolean;
  readonly ctrl: boolean;
}

let sequence = 0;

const f1 = (value: number) => value.toFixed(1);
const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));
const clampX = (x: number) => clamp(x, GEO.left, GEO.left + GEO.innerWidth);
const clampY = (y: number) => clamp(y, GEO.top, GEO.top + GEO.innerHeight);

function project(matrix: DOMMatrix, x: number, y: number): { x: number; y: number } {
  return { x: matrix.a * x + matrix.c * y + matrix.e, y: matrix.b * x + matrix.d * y + matrix.f };
}

function zoneOf(point: { x: number; y: number }): Zone {
  if (point.y > GEO.top + GEO.innerHeight) return 'dates';
  return point.x < GEO.left ? 'prices' : 'plot';
}

/** Couleur d'une vente : celle de sa rareté (thème du site). */
function rarityFill(rarity: string): string {
  const known = parseRarity(rarity);
  return known ? rarityColor(known) : 'currentColor';
}

/** Valeur d'une moyenne à l'abscisse `x` (interpolée entre ses deux points voisins), hors courbe : `undefined`. */
function interpolate(points: readonly { x: number; y: number; price: number }[], x: number) {
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last || x < first.x || x > last.x) return undefined;
  for (let j = 1; j < points.length; j++) {
    const a = points[j - 1];
    const b = points[j];
    if (!a || !b || x > b.x) continue;
    const f = b.x > a.x ? (x - a.x) / (b.x - a.x) : 1;
    return { price: a.price + (b.price - a.price) * f, y: a.y + (b.y - a.y) * f };
  }
  return undefined;
}

export interface SalesChartProps {
  readonly model: ChartModel;
  /** Moyennes affichées (réglage) ; Maj les montre de toute façon. */
  readonly showAverages: boolean;
}

/**
 * Graphique des ventes (points à la couleur de leur rareté, ligne, fond jusqu'au prix 0, moyennes mobiles).
 * Survol : le point le plus proche (prix, date, rareté). Maj : ventes atténuées, moyennes au curseur. Ctrl :
 * règle horizontale avec son prix. Glisser dans le tracé : déplacer ; sur l'axe des dates (droite = avant) ou
 * des prix (haut = avant) : zoom de cet axe ; molette : zoom autour du curseur (un seul axe sur sa graduation).
 * R : 30 derniers jours (vue de départ), A : toutes les ventes (chacune désactivable). À remonter (`key`)
 * pour d'autres ventes.
 */
export function SalesChart({ model, showAverages }: SalesChartProps) {
  const [clip] = useState(() => `wm-market-clip-${++sequence}`);
  const [view, setView] = useState(model.initial);
  const [hover, setHover] = useState<Hover>();
  const [tip, setTip] = useState<Tip>();
  const [keys, setKeysState] = useState<Keys>({ shift: false, ctrl: false });
  const [dragging, setDragging] = useState(false);
  const svg = useRef<SVGSVGElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const tipBox = useRef<HTMLDivElement>(null);
  // Lus par les écouteurs : toujours la dernière valeur, sans attendre le rendu.
  const viewRef = useRef(view);
  const keysRef = useRef(keys);
  const pointer = useRef<{ x: number; y: number }>();
  const drag = useRef<Drag>();

  const coordinates = (current: View) =>
    model.points.map((point) => ({ x: xOf(GEO, current, point.u), y: yOf(GEO, current, point.price) }));

  function refresh(current = viewRef.current): void {
    const matrix = pointer.current && svg.current?.getScreenCTM();
    const at = pointer.current;
    if (!matrix || !at) {
      setHover(undefined);
      setTip(undefined);
      return;
    }
    const inside = project(matrix.inverse(), at.x, at.y);
    const { shift, ctrl } = keysRef.current;
    if (ctrl) {
      const y = clampY(inside.y);
      setHover({ kind: 'rule', y, price: pOfY(GEO, current, y) });
      setTip(undefined);
      return;
    }
    if (shift && model.averages.length) {
      const x = clampX(inside.x);
      const values = model.averages.map((line) =>
        interpolate(
          line.points.map((point) => ({ x: xOf(GEO, current, point.u), y: yOf(GEO, current, point.price), price: point.price })),
          x,
        ),
      );
      const top = Math.min(GEO.top + GEO.innerHeight, ...values.flatMap((value) => (value ? [value.y] : [])));
      const anchor = project(matrix, x, top);
      setHover({ kind: 'averages', x, values });
      setTip({
        x: anchor.x,
        y: anchor.y,
        content: (
          <>
            {model.averages.map((line, index) => {
              const value = values[index];
              return (
                <span key={line.n}>
                  <b style={{ color: line.color }}>
                    {value ? (
                      <>
                        <Coin />
                        {formatNumber(round1(value.price))}
                      </>
                    ) : (
                      '—'
                    )}
                  </b>{' '}
                  <span class="wm-market-muted">moy. {line.n}</span>
                  {' · '}
                </span>
              );
            })}
            {cursorDateLabel(model, current, uOfX(GEO, current, x))}
          </>
        ),
      });
      return;
    }
    if (drag.current?.moved) {
      setHover(undefined);
      setTip(undefined);
      return;
    }
    let best: { index: number; distance: number; x: number; y: number } | undefined;
    coordinates(current).forEach((point, index) => {
      const screen = project(matrix, point.x, point.y);
      const distance = Math.hypot(screen.x - at.x, screen.y - at.y);
      if (!best || distance < best.distance) best = { index, distance, ...screen };
    });
    const found = best && best.distance <= HOVER_PX ? best : undefined;
    const point = found && model.points[found.index];
    if (!found || !point) {
      setHover(undefined);
      setTip(undefined);
      return;
    }
    setHover({ kind: 'point', index: found.index });
    setTip({
      x: found.x,
      y: found.y,
      content: (
        <>
          <b>
            <Coin />
            {formatNumber(point.price)}
          </b>
          {` · ${formatDate(point.time)} ${formatTime(point.time)}${point.rarity ? ` · ${point.rarity}` : ''}`}
        </>
      ),
    });
  }

  function apply(next: View): View {
    const clamped = clampView(model, next);
    viewRef.current = clamped;
    setView(clamped);
    return clamped;
  }

  function setKeys(shift: boolean, ctrl: boolean): void {
    if (shift === keysRef.current.shift && ctrl === keysRef.current.ctrl) return;
    keysRef.current = { shift, ctrl };
    setKeysState(keysRef.current);
    refresh();
  }

  function svgPoint(clientX: number, clientY: number) {
    const matrix = svg.current?.getScreenCTM();
    return matrix ? project(matrix.inverse(), clientX, clientY) : undefined;
  }

  // Touches lues sur toute la fenêtre : l'affichage change sans bouger la souris.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      setKeys(event.shiftKey, event.ctrlKey);
      if (event.type !== 'keydown' || event.ctrlKey || event.altKey || event.metaKey) return;
      const key = event.key.toLowerCase();
      if (key === 'r' && marketSettings.get('recentKey')) refresh(apply(model.initial));
      if (key === 'a' && marketSettings.get('allKey')) refresh(apply(model.all));
    };
    const onBlur = () => setKeys(false, false);
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('keyup', onKey, true);
    window.addEventListener('blur', onBlur);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('keyup', onKey, true);
      window.removeEventListener('blur', onBlur);
    };
  }, []);

  // Molette : zoom autour du curseur. Écouteur non passif, pour que la page (ou la modale) ne défile pas.
  useEffect(() => {
    const element = svg.current;
    if (!element) return;
    const onWheel = (event: WheelEvent) => {
      const inside = svgPoint(event.clientX, event.clientY);
      if (!inside) return;
      event.preventDefault();
      const zone = zoneOf(inside);
      const delta = event.deltaMode === 1 ? event.deltaY * 33 : event.deltaMode === 2 ? event.deltaY * 300 : event.deltaY;
      const k = Math.exp(clamp(delta, -300, 300) * 0.002);
      let next = viewRef.current;
      if (zone !== 'prices') next = zoomDates(next, uOfX(GEO, next, clampX(inside.x)), k);
      if (zone !== 'dates') next = zoomPrices(next, pOfY(GEO, next, clampY(inside.y)), k);
      pointer.current = { x: event.clientX, y: event.clientY };
      refresh(apply(next));
    };
    element.addEventListener('wheel', onWheel, { passive: false });
    return () => element.removeEventListener('wheel', onWheel);
  }, []);

  // Déplacement et zooms à la souris : suivis sur toute la fenêtre tant que le bouton est enfoncé.
  useEffect(() => {
    const onMove = (event: MouseEvent) => {
      const current = drag.current;
      const a = current && svgPoint(current.startX, current.startY);
      const b = svgPoint(event.clientX, event.clientY);
      if (!current || !a || !b) return;
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      if (!current.moved) {
        if (Math.hypot(dx, dy) < 2) return;
        current.moved = true;
        setDragging(current.zone === 'plot');
      }
      const start = current.view;
      let next: View;
      if (current.zone === 'plot') {
        const du = (-dx / GEO.innerWidth) * (start.u1 - start.u0);
        const dp = (dy / GEO.innerHeight) * (start.p1 - start.p0);
        next = { u0: start.u0 + du, u1: start.u1 + du, p0: start.p0 + dp, p1: start.p1 + dp };
      } else if (current.zone === 'dates') {
        next = zoomDates(start, uOfX(GEO, start, clampX(current.anchorX)), Math.exp(-dx / DRAG_ZOOM));
      } else {
        next = zoomPrices(start, pOfY(GEO, start, clampY(current.anchorY)), Math.exp(dy / DRAG_ZOOM));
      }
      pointer.current = { x: event.clientX, y: event.clientY };
      refresh(apply(next));
    };
    const onUp = () => {
      if (!drag.current) return;
      drag.current = undefined;
      setDragging(false);
      refresh();
    };
    window.addEventListener('mousemove', onMove, true);
    window.addEventListener('mouseup', onUp, true);
    return () => {
      window.removeEventListener('mousemove', onMove, true);
      window.removeEventListener('mouseup', onUp, true);
    };
  }, []);

  // Info-bulle au-dessus de son ancre, gardée dans la largeur du graphique.
  useLayoutEffect(() => {
    const box = tipBox.current;
    const area = wrap.current?.getBoundingClientRect();
    if (!box || !area || !tip) return;
    const half = box.offsetWidth / 2 + 2;
    box.style.left = `${clamp(tip.x - area.left, half, area.width - half)}px`;
    box.style.top = `${tip.y - area.top}px`;
  }, [tip]);

  const points = coordinates(view);
  const first = points[0];
  const last = points.at(-1);
  if (!first || !last) return null;
  const line = points.map((point) => `${f1(point.x)},${f1(point.y)}`).join(' ');
  const zeroY = yOf(GEO, view, 0);
  const right = GEO.width - GEO.right;
  const bottom = GEO.top + GEO.innerHeight;
  // Découpe à la zone tracée : fond, ligne et moyennes à 2 px près, points à leur rayon près.
  const edge = (margin: number) => (
    <rect x={GEO.left - margin} y={GEO.top - margin} width={GEO.innerWidth + 2 * margin} height={GEO.innerHeight + 2 * margin} />
  );
  const span = view.u1 - view.u0;
  const averageLines = model.averages.map((average) =>
    average.points.map((point) => ({ ...point, x: xOf(GEO, view, point.u), y: yOf(GEO, view, point.price) })),
  );

  return (
    <div ref={wrap} class="wm-market-chart-wrap">
      <svg
        ref={svg}
        class="wm-market-chart"
        viewBox={`0 0 ${GEO.width} ${GEO.height}`}
        aria-hidden="true"
        data-averages={showAverages || keys.shift || undefined}
        data-dim={keys.shift || undefined}
        data-drag={dragging || undefined}
        onMouseMove={(event) => {
          pointer.current = { x: event.clientX, y: event.clientY };
          setKeys(event.shiftKey, event.ctrlKey);
          if (!drag.current && svg.current) {
            const inside = svgPoint(event.clientX, event.clientY);
            const zone = inside ? zoneOf(inside) : 'plot';
            svg.current.style.cursor = zone === 'dates' ? 'ew-resize' : zone === 'prices' ? 'ns-resize' : 'crosshair';
          }
          refresh();
        }}
        onMouseLeave={() => {
          pointer.current = undefined;
          refresh();
        }}
        onMouseDown={(event) => {
          if (event.button !== 0) return;
          const inside = svgPoint(event.clientX, event.clientY);
          if (!inside) return;
          event.preventDefault();
          drag.current = {
            zone: zoneOf(inside),
            startX: event.clientX,
            startY: event.clientY,
            anchorX: inside.x,
            anchorY: inside.y,
            view: viewRef.current,
            moved: false,
          };
        }}
      >
        <defs>
          <clipPath id={`${clip}-a`}>{edge(2)}</clipPath>
          <clipPath id={`${clip}-b`}>{edge(RADIUS + 2)}</clipPath>
        </defs>
        <g>
          {priceTicks(view, PRICE_TICKS).map((price) => {
            const y = f1(yOf(GEO, view, price));
            return (
              <g key={price}>
                <line class="wm-market-grid" x1={GEO.left} x2={right} y1={y} y2={y} />
                <text x={GEO.left - 5} y={f1(yOf(GEO, view, price) + 3.5)} text-anchor="end">
                  {formatNumber(Math.round(price * 100) / 100)}
                </text>
              </g>
            );
          })}
        </g>
        <g clip-path={`url(#${clip}-a)`}>
          <polygon
            class="wm-market-area"
            points={`${f1(first.x)},${f1(zeroY)} ${line} ${f1(last.x)},${f1(zeroY)}`}
            fill="currentColor"
            opacity=".1"
          />
          <line class="wm-market-axis" x1={GEO.left} x2={right} y1={f1(zeroY)} y2={f1(zeroY)} />
          <polyline class="wm-market-line" points={line} fill="none" stroke="currentColor" stroke-width="1.5" opacity=".85" />
          {model.averages.map((average, index) => {
            const series = averageLines[index] ?? [];
            const solid = series.filter((point) => point.full);
            return (
              <g key={average.n} class="wm-market-average" style={{ color: average.color }}>
                {average.partial.map(({ from, to, opacity }) => {
                  const a = series[from];
                  const b = series[to];
                  return a && b ? (
                    <line key={from} x1={f1(a.x)} y1={f1(a.y)} x2={f1(b.x)} y2={f1(b.y)} stroke-dasharray="3 3" opacity={opacity.toFixed(2)} />
                  ) : null;
                })}
                {solid.length >= 2 && <polyline points={solid.map((point) => `${f1(point.x)},${f1(point.y)}`).join(' ')} />}
              </g>
            );
          })}
        </g>
        <g clip-path={`url(#${clip}-b)`}>
          {points.map((point, index) => {
            const on = hover?.kind === 'point' && hover.index === index;
            return (
              <circle
                key={index}
                class="wm-market-point"
                data-on={on || undefined}
                cx={f1(point.x)}
                cy={f1(point.y)}
                r={on ? RADIUS + 1.6 : RADIUS}
                fill={rarityFill(model.points[index]?.rarity ?? '')}
              />
            );
          })}
        </g>
        <g>
          {model.byIndex ? (
            <text x={f1(GEO.left + GEO.innerWidth / 2)} y={GEO.height - 6} text-anchor="middle">
              {shortDate(model.points[0]?.time ?? 0)}
            </text>
          ) : (
            dateTicks(view, DATE_TICKS).map((time, index) => (
              <text
                key={index}
                x={f1(xOf(GEO, view, time))}
                y={GEO.height - 6}
                text-anchor={index === 0 ? 'start' : index === DATE_TICKS - 1 ? 'end' : 'middle'}
              >
                {dateTickLabel(time, span)}
              </text>
            ))
          )}
        </g>
        {hover?.kind === 'averages' && (
          <g>
            <line class="wm-market-guide" x1={f1(hover.x)} x2={f1(hover.x)} y1={GEO.top} y2={bottom} />
            {model.averages.map((average, index) => {
              const value = hover.values[index];
              return value ? (
                <circle key={average.n} class="wm-market-average-dot" cx={f1(hover.x)} cy={f1(value.y)} r={RADIUS + 0.6} fill={average.color} />
              ) : null;
            })}
          </g>
        )}
        {hover?.kind === 'rule' && (
          <g class="wm-market-rule">
            <line x1={GEO.left} x2={right} y1={f1(hover.y)} y2={f1(hover.y)} />
            <text x={GEO.left - 5} y={f1(hover.y + 3.5)} text-anchor="end">
              {formatNumber(round1(hover.price))}
            </text>
          </g>
        )}
      </svg>
      {tip && (
        <div ref={tipBox} class="wm-market-tip">
          {tip.content}
        </div>
      )}
    </div>
  );
}
