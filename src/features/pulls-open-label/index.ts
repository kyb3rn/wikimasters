import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findPackButton, PULLS_ROUTE } from '@/site/pulls';

const RAISED = 'wm-open-label';

/**
 * Autant de marge en dessous qu'en moins au-dessus : le bouton garde sa hauteur, la page ne bouge pas.
 * Au survol, le site agrandit tout le bouton (`hover:scale-105`, seulement s'il est actif) ; le texte grossit un peu
 * plus, par transform (une police plus grande changerait la hauteur du bouton et la page, recentrée, bougerait),
 * au rythme de la transition du bouton.
 */
const CSS = `
.${RAISED}.${RAISED} { margin-top: -1.5rem; margin-bottom: 1.5rem; transition: inherit; }
button:not(:disabled):hover > .${RAISED}.${RAISED} { transform: scale(1.04); }
`;

export const pullsOpenLabel: Feature = {
  id: 'pulls-open-label',
  name: '« Ouvrir » sous le paquet',
  description: 'Le texte « Ouvrir » est rapproché du paquet, et grossit un peu plus que lui au survol.',
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    await whenBody();
    if (ctx.signal.aborted) return;
    injectStyle('pulls-open-label', CSS);
    watchDom(
      () => {
        const button = findPackButton();
        if (button) setClass(button.label, RAISED, true);
      },
      { signal: ctx.signal },
    );
    ctx.onDispose(() => document.querySelectorAll(`.${RAISED}`).forEach((el) => el.classList.remove(RAISED)));
  },
};
