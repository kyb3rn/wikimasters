import type { Feature } from '@/core/runtime';
import { BALANCE_BOX, BALANCE_ROW } from '@/site/header';
import { tokens } from '@/ui/theme';

const GAP = '4px';
/** Entre les boutons et le bord du fond. */
const PADDING = '6px';
/**
 * Marge du fond en haut et à droite : celle du site sur ordinateur ; sur mobile, plus serrée, pour que le fond (30 px
 * de boutons, 2 × 6 px autour) dépasse à peine de sa barre de 44 px sur la page au repos.
 */
const DESKTOP_MARGIN = '0.75rem';
const MOBILE_MARGIN = '6px';

/*
 * Le cadre du site devient le fond : rien n'est enveloppé ni déplacé. Son `padding` est en style dans la boîte
 * ordinateur, d'où `!important`. Les clics sur le fond ne traversent plus jusqu'à la page qu'il recouvre.
 */
const CSS = `
:is(${BALANCE_BOX}, ${BALANCE_ROW}) { box-sizing: border-box; align-items: center; gap: ${GAP}; padding: ${PADDING} !important;
  border-radius: 9999px; background: ${tokens.backdrop}; backdrop-filter: ${tokens.backdropBlur}; pointer-events: auto; }
${BALANCE_BOX} { margin: max(${DESKTOP_MARGIN}, env(safe-area-inset-top, 0px)) max(${DESKTOP_MARGIN}, env(safe-area-inset-right, 0px)) 0 0; }
@media (min-width: 48rem) { ${BALANCE_BOX} { display: flex; } }
${BALANCE_ROW} { width: fit-content; height: auto; margin: ${MOBILE_MARGIN} max(${MOBILE_MARGIN}, env(safe-area-inset-right, 0px)) 0 auto; }
`;

export const headerBar: Feature = {
  id: 'header-bar',
  name: 'En-tête',
  description: 'Le solde, la cloche et l’engrenage sur un fond foncé arrondi, lisibles au-dessus de la page qui défile.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  mount(ctx) {
    // Feuille seule, posée dès le chargement : le cadre a son fond dès que le site le dessine.
    ctx.style(CSS);
  },
};
