import { useLayoutEffect, useMemo, useRef, useState } from 'preact/hooks';
import type { Sale } from '@/site/api';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { formatNumber } from './format';
import { SiteRarityBadge } from './SiteRarityBadge';
import { dateTickLabel, preserveEnd, siteChart, siteStats, tooltipDate, tooltipOffset, type SiteChart } from './site-view';

// Mesures de son graphique (Recharts) : 200 px de haut, marges, axes, graduations, points.
const HEIGHT = 200;
const TOP = 4;
const RIGHT = 8;
const Y_AXIS_WIDTH = 48;
const X_AXIS_HEIGHT = 30;
const BOTTOM = HEIGHT - X_AXIS_HEIGHT;
/** Trait d'une graduation des dates, et écart entre lui et son libellé. */
const TICK_SIZE = 6;
const TICK_MARGIN = 2;
/** Écart minimal entre deux libellés de dates. */
const DATE_GAP = 28;
/**
 * Hauteur d'un libellé de prix (9 px, interligne 1,5 de la page) et écart minimal entre deux. Recharts garde chaque
 * libellé dans tout le graphique, pas seulement dans le tracé : celui du haut descend de 2,75 px (relevé sur sa page).
 */
const PRICE_LABEL_HEIGHT = 13.5;
const PRICE_GAP = 5;

let measureContext: CanvasRenderingContext2D | null | undefined;

/** Largeur d'un libellé des dates (9 px), mesurée comme Recharts mesure les siens. */
function textWidth(text: string, fontFamily: string): number {
  measureContext ??= document.createElement('canvas').getContext('2d');
  if (!measureContext) return text.length * 5;
  measureContext.font = `9px ${fontFamily}`;
  return measureContext.measureText(text).width;
}

function Tile({ label, value, price = false }: { label: string; value: number; price?: boolean }) {
  return (
    <div class={siteClass.marketViewTile}>
      <p class={siteClass.marketViewTileLabel}>{label}</p>
      {price ? (
        <p class={siteClass.marketViewTilePrice}>
          <Icon name="coin" class={siteClass.marketViewTileCoin} />
          {formatNumber(value)}
        </p>
      ) : (
        <p class={siteClass.marketViewTileValue}>{value}</p>
      )}
    </div>
  );
}

/** Texte d'un axe : 9 px, couleur du texte à 45 %. */
const axisText = { style: { fill: tokens.foreground }, 'fill-opacity': '0.45', 'font-size': '9' } as const;

interface PlotProps {
  readonly sales: readonly Sale[];
  readonly chart: SiteChart;
  readonly average: number;
}

/** Le graphique : aire et courbe des prix, moyenne en pointillé, axes, info-bulle de la vente la plus proche du curseur. */
function Plot({ sales, chart, average }: PlotProps) {
  const box = useRef<HTMLDivElement>(null);
  const tip = useRef<HTMLDivElement>(null);
  const [frame, setFrame] = useState<{ readonly width: number; readonly font: string }>();
  const [hover, setHover] = useState<{ readonly index: number; readonly y: number }>();
  const shownTip = useRef(false);

  // Largeur de son conteneur, dès l'affichage puis à chaque changement (comme son graphique « responsive »).
  useLayoutEffect(() => {
    const element = box.current;
    if (!element) return;
    const measure = () => {
      const width = element.clientWidth;
      const font = getComputedStyle(element).fontFamily;
      setFrame((current) => (current?.width === width && current.font === font ? current : { width, font }));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  const right = (frame?.width ?? 0) - RIGHT;
  const x = (time: number) => Y_AXIS_WIDTH + ((time - chart.t0) / (chart.t1 - chart.t0)) * (right - Y_AXIS_WIDTH);
  const y = (price: number) => TOP + (1 - (price - chart.p0) / (chart.p1 - chart.p0)) * (BOTTOM - TOP);
  const points = sales.map((sale) => ({ sale, x: x(sale.time), y: y(sale.price) }));
  const active = hover && points[hover.index];

  // Info-bulle placée une fois mesurée ; elle glisse d'un point à l'autre, mais apparaît d'emblée à sa place.
  useLayoutEffect(() => {
    const element = tip.current;
    if (!element || !active || !hover) {
      shownTip.current = false;
      return;
    }
    const left = tooltipOffset(active.x, element.offsetWidth, Y_AXIS_WIDTH, right - Y_AXIS_WIDTH);
    const top = tooltipOffset(hover.y, element.offsetHeight, TOP, BOTTOM - TOP);
    element.style.transition = shownTip.current ? 'transform 120ms ease' : 'none';
    element.style.transform = `translate(${left}px, ${top}px)`;
    element.style.visibility = 'visible';
    shownTip.current = true;
  });

  const dateTicks = useMemo(() => {
    if (!frame) return [];
    const labels = points.map((point) => dateTickLabel(point.sale.time, chart.spanMs));
    const ticks = points.map((point, index) => ({ coordinate: point.x, size: textWidth(labels[index] ?? '', frame.font) }));
    return preserveEnd(ticks, 0, frame.width, DATE_GAP).map(({ index, at }) => ({
      key: index,
      x: points[index]?.x ?? at,
      at,
      label: labels[index] ?? '',
    }));
  }, [sales, chart, frame]);

  // Graduations des prix vues du bas du graphique (coordonnées croissantes, comme celles des dates).
  const priceTicks = useMemo(() => {
    const ticks = chart.priceTicks.map((price) => ({ coordinate: HEIGHT - y(price), size: PRICE_LABEL_HEIGHT }));
    return preserveEnd(ticks, 0, HEIGHT, PRICE_GAP).map(({ index, at }) => {
      const price = chart.priceTicks[index] ?? 0;
      return { price, y: y(price), at: HEIGHT - at };
    });
  }, [chart]);

  function onMove(event: PointerEvent): void {
    const rect = box.current?.getBoundingClientRect();
    if (!rect) return;
    const px = event.clientX - rect.left;
    const py = event.clientY - rect.top;
    if (px < Y_AXIS_WIDTH || px > right || py < TOP || py > BOTTOM) {
      setHover(undefined);
      return;
    }
    let index = 0;
    points.forEach((point, i) => {
      if (Math.abs(point.x - px) < Math.abs((points[index]?.x ?? Infinity) - px)) index = i;
    });
    setHover({ index, y: py });
  }

  const line = points.map((point, index) => `${index ? 'L' : 'M'}${point.x},${point.y}`).join('');
  const area = `${line}L${points.at(-1)?.x ?? 0},${BOTTOM}L${points[0]?.x ?? 0},${BOTTOM}Z`;
  const averageY = y(average);

  return (
    <div
      ref={box}
      class="wm-site-chart"
      style={{ position: 'relative', width: '100%', height: `${HEIGHT}px` }}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(undefined)}
    >
      {frame && frame.width > 0 && (
        <svg width={frame.width} height={HEIGHT} viewBox={`0 0 ${frame.width} ${HEIGHT}`} style={{ display: 'block' }}>
          <defs>
            <linearGradient id="wm-site-chart-gradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" style={{ stopColor: tokens.accent }} stop-opacity="0.28" />
              <stop offset="95%" style={{ stopColor: tokens.accent }} stop-opacity="0.02" />
            </linearGradient>
          </defs>
          {priceTicks.map((tick) => (
            <line
              key={tick.price}
              x1={Y_AXIS_WIDTH}
              x2={right}
              y1={tick.y}
              y2={tick.y}
              style={{ stroke: tokens.border }}
              stroke-dasharray="3 3"
              stroke-opacity="0.65"
            />
          ))}
          <path d={area} fill="url(#wm-site-chart-gradient)" fill-opacity="0.6" stroke="none" />
          {sales.length > 1 && (
            <line
              class="wm-site-chart-average"
              x1={Y_AXIS_WIDTH}
              x2={right}
              y1={averageY}
              y2={averageY}
              style={{ stroke: tokens.foreground }}
              stroke-opacity="0.25"
              stroke-dasharray="5 5"
            />
          )}
          <path d={line} fill="none" style={{ stroke: tokens.accent }} stroke-width="2.5" />
          <line x1={Y_AXIS_WIDTH} x2={right} y1={BOTTOM} y2={BOTTOM} style={{ stroke: tokens.border }} stroke-opacity="0.8" />
          {dateTicks.map((tick) => (
            <line
              key={tick.key}
              x1={tick.x}
              x2={tick.x}
              y1={BOTTOM + TICK_SIZE}
              y2={BOTTOM}
              style={{ stroke: tokens.border }}
              stroke-opacity="0.5"
            />
          ))}
          <g class="wm-site-chart-dots">
            {points.map((point) => (
              <circle key={point.sale.id} cx={point.x} cy={point.y} r="3" style={{ fill: tokens.accent, stroke: tokens.surface }} stroke-width="2" />
            ))}
          </g>
          {active && (
            <>
              <line
                x1={active.x}
                x2={active.x}
                y1={TOP}
                y2={BOTTOM}
                style={{ stroke: tokens.accent }}
                stroke-width="1"
                stroke-dasharray="4 4"
                stroke-opacity="0.55"
              />
              <circle cx={active.x} cy={active.y} r="5.5" style={{ fill: tokens.accent, stroke: tokens.surface }} stroke-width="2" />
            </>
          )}
          <g class="wm-site-chart-dates">
            {dateTicks.map((tick) => (
              <text key={tick.key} x={tick.at} y={BOTTOM + TICK_SIZE + TICK_MARGIN + 4} text-anchor="middle" {...axisText}>
                <tspan x={tick.at} dy="0.71em">
                  {tick.label}
                </tspan>
              </text>
            ))}
          </g>
          <g class="wm-site-chart-prices">
            {priceTicks.map((tick) => (
              <text key={tick.price} x={Y_AXIS_WIDTH - TICK_SIZE - TICK_MARGIN} y={tick.at} text-anchor="end" {...axisText}>
                <tspan x={Y_AXIS_WIDTH - TICK_SIZE - TICK_MARGIN} dy="0.355em">
                  {formatNumber(Math.round(tick.price))}
                </tspan>
              </text>
            ))}
          </g>
          {sales.length > 1 && (
            <text x={right - 5} y={averageY + 5} text-anchor="end" style={{ fill: tokens.foreground }} fill-opacity="0.45" font-size="10">
              <tspan x={right - 5} dy="0.71em">
                Moy. {formatNumber(average)}
              </tspan>
            </text>
          )}
        </svg>
      )}
      {active && (
        <div
          ref={tip}
          class={siteClass.marketViewTip}
          role="tooltip"
          style={{
            position: 'absolute',
            top: 0,
            left: 0,
            pointerEvents: 'none',
            visibility: 'hidden',
            backgroundColor: tokens.surface,
            borderColor: tokens.border,
            color: tokens.foreground,
          }}
        >
          <p class={siteClass.marketViewTipDate}>{tooltipDate(active.sale.time)}</p>
          <div class={siteClass.marketViewTipRow}>
            <SiteRarityBadge rarity={active.sale.rarity} />
            <span class={siteClass.marketViewTipPrice}>
              <Icon name="coin" class={siteClass.marketViewCoin} />
              {formatNumber(active.sale.price)}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

/** Tuiles (ventes, dernier prix, moyenne, min, max), puis le graphique s'il y a au moins deux ventes. */
export function SiteSalesChart({ sales }: { readonly sales: readonly Sale[] }) {
  const stats = useMemo(() => siteStats(sales), [sales]);
  const chart = useMemo(() => siteChart(sales), [sales]);
  if (!stats || !chart) return null;
  return (
    <div class={siteClass.marketViewSection}>
      <div class={siteClass.marketViewTiles}>
        <Tile label="Ventes" value={stats.count} />
        <Tile label="Dernier" value={stats.latest} price />
        <Tile label="Moyenne" value={stats.average} price />
        <Tile label="Min" value={stats.min} price />
        <Tile label="Max" value={stats.max} price />
      </div>
      {sales.length >= 2 && (
        <div class={siteClass.marketViewChart}>
          <Plot sales={sales} chart={chart} average={stats.average} />
        </div>
      )}
    </div>
  );
}
