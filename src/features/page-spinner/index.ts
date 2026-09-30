import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { showsPageSpinner } from '@/site/page-spinner';

const LOADING = 'wm-page-spinner';

/**
 * Le site prévoit le centrage (enveloppe du rond en `flex-1`, `items-center`, `justify-center`), mais `<main>`
 * n'est pas flex : l'enveloppe ne prend que la hauteur du rond, collée en haut. En colonne flex, elle occupe
 * toute la hauteur de `<main>` et le rond tombe au milieu.
 */
const CSS = `main.${LOADING} { display: flex; flex-direction: column; }`;

export const pageSpinner: Feature = {
  id: 'page-spinner',
  name: 'Chargement centré',
  description: 'Le rond de chargement des pages est au milieu de la page, verticalement et horizontalement.',
  category: 'Général',
  routes: 'all',
  required: true,
  hidden: true,
  async mount(ctx) {
    await whenBody();
    if (ctx.signal.aborted) return;
    injectStyle('page-spinner', CSS);
    watchDom(
      () => {
        const main = document.querySelector('main');
        if (main) setClass(main, LOADING, showsPageSpinner(main));
      },
      { signal: ctx.signal },
    );
    ctx.onDispose(() => document.querySelectorAll(`.${LOADING}`).forEach((el) => el.classList.remove(LOADING)));
  },
};
