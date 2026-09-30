import { tokens } from '@/ui/theme';

// Mise en page de l'historique : la modale, la croix, les boutons et l'interrupteur sont ceux de la base.
export const CSS = `
.wm-market { flex: 1; min-width: 0; overflow: auto; display: flex; flex-direction: column; gap: 10px;
  padding: 14px 16px 16px; font-size: 13px; }

.wm-market-tiles { display: grid; grid-template-columns: repeat(3, minmax(0, 1fr)); gap: 6px; }
@media (max-width: 560px) { .wm-market-tiles { grid-template-columns: 1fr 1fr; } }
.wm-market-tile { display: flex; flex-direction: column; gap: 2px; min-width: 0; padding: 6px 8px; border-radius: 8px;
  border: 1px solid ${tokens.border}; background: ${tokens.surfaceLight}; }
.wm-market-tiles[data-empty] .wm-market-tile { opacity: 0.75; }
.wm-market-label { font-size: 10px; text-transform: uppercase; letter-spacing: 0.04em; opacity: 0.45; white-space: nowrap;
  overflow: hidden; text-overflow: ellipsis; }
.wm-market-value { display: inline-flex; align-items: center; gap: 3px; font-size: 13px; font-weight: 600;
  color: ${tokens.accent}; white-space: nowrap; }
.wm-market-value[data-plain] { color: inherit; }
.wm-market-sub { font-size: 10.5px; opacity: 0.55; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.wm-market-muted { opacity: 0.55; }
.wm-market-coin { flex: none; width: 1em; height: 1em; }

/* Raretés : bascules (allumée = ventes affichées), à la couleur de la rareté. */
.wm-market-chips { display: flex; flex-wrap: wrap; gap: 4px; }
.wm-market-chip { display: inline-flex; align-items: center; gap: 3px; padding: 2px 7px; border-radius: 999px;
  border: 1px solid ${tokens.border}; background: ${tokens.surfaceLight}; color: inherit; font: inherit; font-size: 11px;
  line-height: 1.3; white-space: nowrap; cursor: pointer; user-select: none; opacity: 0.4;
  transition: opacity 0.15s, border-color 0.15s; }
.wm-market-chip:hover { opacity: 0.75; }
.wm-market-chip[aria-pressed="true"] { opacity: 1; border-color: currentColor; }

.wm-market-history { display: flex; flex-direction: column; gap: 2px; padding: 6px 8px; border-radius: 8px;
  border: 1px solid ${tokens.border}; background: ${tokens.surfaceLight}; }
.wm-market-chart-head { display: flex; align-items: center; justify-content: space-between; gap: 8px; flex-wrap: wrap; }
.wm-market-chart-head .wm-market-label { flex: 1 1 auto; min-width: 0; }
.wm-market-averages { display: inline-flex; align-items: center; gap: 8px; font-size: 11px; white-space: nowrap; }
.wm-market-averages i { font-style: normal; font-weight: 700; }

.wm-market-chart-wrap { position: relative; margin-top: 2px; user-select: none; }
.wm-market-chart { display: block; width: 100%; height: auto; overflow: visible; color: ${tokens.accent}; }
.wm-market-chart[data-drag] { cursor: grabbing !important; }
.wm-market-chart text { fill: ${tokens.foreground}; opacity: 0.55; font-family: inherit; font-size: 10px; }
.wm-market-grid { stroke: ${tokens.foreground}; opacity: 0.12; stroke-width: 1; vector-effect: non-scaling-stroke; }
/* Ligne du prix 0 : visible quand la vue descend jusque-là. */
.wm-market-axis { stroke: ${tokens.foreground}; opacity: 0.3; stroke-width: 1; vector-effect: non-scaling-stroke; }
.wm-market-area, .wm-market-line { transition: opacity 0.15s; }
.wm-market-point { stroke: ${tokens.surface}; stroke-width: 1; transition: r 0.1s, opacity 0.15s; }
.wm-market-point[data-on] { stroke: #fff; stroke-width: 1.5; }
/* Maj : ventes atténuées pour lire les moyennes. */
.wm-market-chart[data-dim] .wm-market-area { opacity: 0.02; }
.wm-market-chart[data-dim] .wm-market-line { opacity: 0.15; }
.wm-market-chart[data-dim] .wm-market-point { opacity: 0.2; }
.wm-market-chart:not([data-averages]) .wm-market-average { display: none; }
.wm-market-average line, .wm-market-average polyline { stroke: currentColor; fill: none; stroke-width: 1.6;
  stroke-linejoin: round; stroke-linecap: round; vector-effect: non-scaling-stroke; }
.wm-market-guide { stroke: ${tokens.foreground}; opacity: 0.4; stroke-width: 1; stroke-dasharray: 3 3;
  vector-effect: non-scaling-stroke; }
.wm-market-average-dot { stroke: #fff; stroke-width: 1.5; }
/* Ctrl : règle horizontale, prix à gauche (halo du fond pour couvrir la graduation). */
.wm-market-rule line { stroke: ${tokens.accent}; opacity: 0.85; stroke-width: 1; stroke-dasharray: 4 3;
  vector-effect: non-scaling-stroke; }
.wm-market-chart .wm-market-rule text { fill: ${tokens.accent}; opacity: 1; font-weight: 700; stroke: ${tokens.surface};
  stroke-width: 3px; stroke-linejoin: round; paint-order: stroke fill; }

.wm-market-tip { position: absolute; z-index: 5; pointer-events: none; transform: translate(-50%, calc(-100% - 8px));
  padding: 4px 8px; border: 1px solid ${tokens.border}; border-radius: 8px; background: ${tokens.surface}; font-size: 11px;
  white-space: nowrap; box-shadow: 0 4px 12px rgb(0 0 0 / 40%); }
.wm-market-tip b { display: inline-flex; align-items: center; gap: 3px; color: ${tokens.accent}; }
`;
