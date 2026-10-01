import { ROOT_CLASS } from '@/core/dom';
import { PULLS_GRID_CLASSES as C } from '@/services/pulls-grid';
import { ACTIONS_GAP, CARD_HEIGHT, CARD_WIDTH, GAP_X, GAP_Y } from './layout';

/**
 * Zone de la carte du carrousel : invisible mais toujours affichée. Ses animations doivent tourner (le
 * site révèle les shiny à leur fin) et ses images se charger (images `loading="lazy"`, jamais chargées
 * hors de l'écran ou sous `display: none`).
 */
export const OFFSTAGE = 'wm-grid-offstage';
/** Durée de l'arrivée d'une carte. */
export const ARRIVAL_MS = 450;

/**
 * Tant que la grille est affichée : le feu d'artifice des L, parti de la carte invisible du carrousel, n'a plus de
 * sens ici.
 */
export const GRID_ON_CSS = `[class*="animate-card-reveal-firework"] { display: none !important; }`;

export const CSS = `
.${OFFSTAGE} { position: absolute !important; opacity: 0 !important; pointer-events: none !important; }

main .${ROOT_CLASS}.${C.grid} { display: flex; flex-wrap: wrap; justify-content: center; align-items: flex-start;
  gap: ${GAP_Y}px ${GAP_X}px; line-height: inherit; color: inherit; }
.${C.slot} { display: flex; flex-direction: column; align-items: center; gap: ${ACTIONS_GAP}px; }
.${C.slot}:not([data-state="arrived"]) { visibility: hidden; }
.${C.slot}[data-state="arrived"] { animation: wm-pulls-arrive ${ARRIVAL_MS}ms cubic-bezier(0.2, 0.8, 0.2, 1) both; }
.${C.card} { display: flex; align-items: center; justify-content: center;
  width: calc(${CARD_WIDTH}px * var(--wm-zoom, 1)); height: calc(${CARD_HEIGHT}px * var(--wm-zoom, 1)); }
.${C.card} > * { flex: none; zoom: var(--wm-zoom, 1); }
/* Même écart que les boutons de la rangée du carrousel (gap-4). */
.${C.actions} { display: flex; justify-content: center; gap: 16px; }
.${C.actions}:empty { display: none; }
@keyframes wm-pulls-arrive {
  from { opacity: 0; transform: translateY(28px) scale(0.92); }
  to { opacity: 1; transform: none; }
}
@media (prefers-reduced-motion: reduce) { .${C.slot}[data-state="arrived"] { animation-duration: 1ms; } }
`;
