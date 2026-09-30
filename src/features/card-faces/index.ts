import { injectStyle, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { FACE_CORNER_BUTTON, FACE_STATS, FACE_TEXT, SMALL_FACE } from '@/site/cards';

const SLOT = `:has(> ${SMALL_FACE})`;
const CORNER = `${SLOT} > ${FACE_CORNER_BUTTON}`;
/** Transition de la face (`transition-all duration-300`, courbe par défaut de Tailwind). */
const FACE_MOTION = '0.3s cubic-bezier(0.4, 0, 0.2, 1)';

/*
 * Le site laisse 16 px sous ATK · DEF (p-3 du texte, py-1 de leur rangée) : ramenés à 8.
 *
 * Bouton du coin, devenu un rond standard plus grand que le sien : centré au même endroit, à 4 px du coin. Au survol,
 * la face grandit de 5 % depuis son centre (`hover:scale-105`), son coin s'écarte de 2,5 % de sa taille : le bouton
 * le suit (`top` et `right` en % de la case, qui a la taille de la face). La face reste agrandie tant que le curseur
 * est sur le bouton, sinon elle rétrécirait sous lui et le bouton repartirait.
 */
const CSS = `
${SMALL_FACE} > ${FACE_TEXT} { padding-bottom: 6px; }
${SMALL_FACE} > ${FACE_STATS} { padding-bottom: 2px; }
${CORNER} { top: 0.25rem; right: 0.25rem; translate: 50% -50%;
  transition: top ${FACE_MOTION}, right ${FACE_MOTION}, color 0.15s, background-color 0.15s, border-color 0.15s; }
@media (hover: hover) {
  ${SLOT}:has(> ${FACE_CORNER_BUTTON}):hover > ${SMALL_FACE} { scale: 1.05; z-index: 10; }
  ${SLOT}:hover > ${FACE_CORNER_BUTTON} { top: calc(0.25rem * 1.05 - 2.5%); right: calc(0.25rem * 1.05 - 2.5%); }
}
`;

export const cardFaces: Feature = {
  id: 'card-faces',
  name: 'Cartes des grilles',
  description: 'Cartes des grilles : ATK et DEF plus près du bas de la carte, bouton du coin qui suit la carte au survol.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    await whenBody();
    if (ctx.signal.aborted) return;
    injectStyle('card-faces', CSS);
    ctx.onDispose(() => document.getElementById('wm-style-card-faces')?.remove());
  },
};
