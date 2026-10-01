import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findCarousel } from '@/site/pulls';
import { PULLS_ROUTE } from '@/site/routes';
import { tokens } from '@/ui/theme';

const TEXT = 'wm-remaining-text';

/** « Encore n cartes » en texte gris : le bouton du site, désactivé, sans son allure de bouton. */
const CSS = `
.${TEXT} { background: none !important; box-shadow: none !important; padding-left: 0 !important;
  padding-right: 0 !important; color: ${tokens.foreground} !important; opacity: 0.5 !important;
  font-weight: 400 !important; font-size: 0.875rem !important; cursor: default !important; }
`;

export const pullsRemaining: Feature = {
  id: 'pulls-remaining',
  name: 'Cartes restantes',
  description: "« Encore n cartes » en texte gris : le bouton n'apparaît que pour « Continuer ».",
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    const marks = classMarks(ctx.signal);

    // Le site désactive ce bouton tant que toutes les cartes n'ont pas été vues (« Encore n cartes »),
    // puis l'active (« Continuer ») : on suit son état.
    watchDom(
      () => {
        const proceed = findCarousel()?.proceed;
        marks.only(TEXT, proceed?.disabled ? [proceed] : []);
      },
      { signal: ctx.signal },
    );
  },
};
