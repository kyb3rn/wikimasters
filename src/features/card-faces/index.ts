import type { Feature } from '@/core/runtime';
import { FACE_CORNER_BUTTON, FACE_SELECTION_BOX, FACE_STATS, FACE_TEXT, SMALL_FACE } from '@/site/cards';
import { SELECTION_BADGE } from '@/site/selection';

const SLOT = `:has(> ${SMALL_FACE})`;
const CORNER = `${SLOT} > ${FACE_CORNER_BUTTON}`;
const BOX = `${SLOT} > ${FACE_SELECTION_BOX}`;
const BADGE = `${SLOT} > ${SELECTION_BADGE}`;
/** Transition de la face (`transition-all duration-300`, courbe par défaut de Tailwind). */
const FACE_MOTION = '0.3s cubic-bezier(0.4, 0, 0.2, 1)';

/*
 * Le site laisse 16 px sous ATK · DEF (p-3 du texte, py-1 de leur rangée) : ramenés à 8.
 *
 * Bouton du coin, devenu un rond standard plus grand que le sien : centré au même endroit, à 4 px du coin. Au survol,
 * la face grandit de 5 % depuis son centre (`hover:scale-105`), son coin s'écarte de 2,5 % de sa taille : le bouton
 * le suit (`top` et `right` en % de la case, qui a la taille de la face). La face reste agrandie tant que le curseur
 * est sur le bouton, sinon elle rétrécirait sous lui et le bouton repartirait.
 *
 * Case à cocher du mode sélection (Collection, Toutes les cartes, échanges), à 6 px du coin : même calcul, elle reste à
 * 6 px (agrandis) du coin de la face agrandie, comme l'anneau du voile qui grandit avec elle. De même pour le signet de
 * la liste de souhaits, dans le coin haut gauche (sélection de Toutes les cartes).
 */
const CSS = `
${SMALL_FACE} > ${FACE_TEXT} { padding-bottom: 6px; }
${SMALL_FACE} > ${FACE_STATS} { padding-bottom: 2px; }
${BOX} { transition: top ${FACE_MOTION}, right ${FACE_MOTION}; }
${BADGE} { transition: top ${FACE_MOTION}, left ${FACE_MOTION}; }
${CORNER} { top: 0.25rem; right: 0.25rem; translate: 50% -50%;
  transition: top ${FACE_MOTION}, right ${FACE_MOTION}, color 0.15s, background-color 0.15s, border-color 0.15s; }
@media (hover: hover) {
  ${SLOT}:has(> ${FACE_CORNER_BUTTON}):hover > ${SMALL_FACE} { scale: 1.05; z-index: 10; }
  ${SLOT}:hover > ${FACE_CORNER_BUTTON} { top: calc(0.25rem * 1.05 - 2.5%); right: calc(0.25rem * 1.05 - 2.5%); }
  ${SLOT}:hover > ${FACE_SELECTION_BOX} { top: calc(0.375rem * 1.05 - 2.5%); right: calc(0.375rem * 1.05 - 2.5%); }
  ${SLOT}:hover > ${SELECTION_BADGE} { top: calc(0.375rem * 1.05 - 2.5%); left: calc(0.375rem * 1.05 - 2.5%); }
}
`;

export const cardFaces: Feature = {
  id: 'card-faces',
  name: 'Cartes des grilles',
  description: 'Cartes des grilles : ATK et DEF plus près du bas de la carte, bouton du coin, case à cocher et signet qui suivent la carte au survol.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  mount(ctx) {
    ctx.style(CSS);
  },
};
