import type { Feature } from '@/core/runtime';
import { flexMainWhile } from '@/services/main-column';
import { showsPageSpinner } from '@/site/page-spinner';
import { PULLS_ROUTE } from '@/site/routes';

const CENTERED = 'wm-pulls-center';

/**
 * Le site prévoit le centrage (unique enfant de `<main>` en `flex-1`, `justify-center`, `md:items-center`),
 * mais `<main>` n'est pas flex : l'enfant ne prend que la hauteur de son contenu, collé en haut.
 * Ici `<main>` passe en colonne flex (`flexMainWhile`), l'enfant garde la hauteur de son contenu et deux cales se partagent
 * l'espace libre, 40 % au-dessus et 60 % en dessous (un peu plus haut que le centre, à toutes les largeurs).
 * Contenu plus haut que la page : cales à zéro, il commence en haut et défile.
 */
const CSS = `
main.${CENTERED} > div { flex: none; }
main.${CENTERED}::before, main.${CENTERED}::after { content: ''; flex: 2 1 0; }
main.${CENTERED}::after { flex-grow: 3; }
`;

export const pullsCenter: Feature = {
  id: 'pulls-center',
  name: 'Contenu centré',
  description: "Le contenu de la page des paquets est centré verticalement, un peu plus haut que le milieu (40 % de l'espace libre au-dessus, 60 % en dessous).",
  category: 'Paquets',
  routes: [PULLS_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    // Pendant le chargement, le rond de chargement est au milieu (page-spinner), pas à 40 / 60.
    flexMainWhile(ctx, CENTERED, (main) => !showsPageSpinner(main));
  },
};
