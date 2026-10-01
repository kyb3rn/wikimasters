import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { flexMainWhile } from '@/services/main-column';
import { findAuctionNotFound } from '@/site/marketplace';
import { AUCTION_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { alpha, tokens } from '@/ui/theme';
import { NotFoundExtras } from './NotFoundExtras';

const PAGE = 'wm-auction-not-found-page';

/**
 * Comme « Profil introuvable » : bloc du site en colonne flex sur toute la hauteur de `<main>`, contenu centré. Le
 * texte du site est un nœud texte nu : l'icône, ajoutée après lui, passe devant par `order`. Texte à 60 % comme
 * celui du profil (le site met 50 % ici).
 */
const CSS = `
.${PAGE} {
  display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 1rem;
  color: ${alpha(tokens.foreground, 60)};
}
.${PAGE} .wm-not-found-icon { order: -1; }
`;

export const auctionNotFound: Feature = {
  id: 'auction-not-found',
  name: 'Enchère introuvable',
  description: "Le message « Enchère introuvable » est au milieu de la page, comme celui d'un profil introuvable.",
  category: 'Marché',
  routes: [AUCTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ctx.style(CSS);
    flexMainWhile(ctx, 'wm-auction-not-found', (main) => findAuctionNotFound(main) !== undefined);

    const extras = createSlot(signal);
    const marks = classMarks(signal);
    watchDom(
      () => {
        const main = document.querySelector('main');
        const page = main ? findAuctionNotFound(main) : undefined;
        marks.only(PAGE, page ? [page] : []);
        if (page) extras.render(h(NotFoundExtras, {}), { parent: page, inline: true });
        else extras.clear();
      },
      { signal },
    );
  },
};
