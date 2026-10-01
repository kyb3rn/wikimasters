import { classMarks, watchDom } from '@/core/dom';
import type { FeatureContext } from '@/core/runtime';

/**
 * `<main>` en colonne flex tant que `shows(main)`. Le site prévoit le centrage de certains contenus qui tiennent lieu
 * de page (rond de chargement, « Profil introuvable »… : unique enfant `flex-1`, `items-center`, `justify-center`),
 * mais `<main>` n'est pas flex : ce bloc ne prend que la hauteur de son contenu, collé en haut. En colonne flex, il
 * occupe toute la hauteur de `<main>` et son contenu tombe au milieu.
 *
 * `className` : classe posée sur `<main>`, une par fonctionnalité (deux usages ne s'effacent pas l'un l'autre).
 * À appeler une fois `<body>` là (`ctx.ready()`) ; tout est retiré au démontage.
 */
export function flexMainWhile(ctx: FeatureContext, className: string, shows: (main: Element) => boolean): void {
  ctx.style(`main.${className} { display: flex; flex-direction: column; }`, 'main-column');
  const marks = classMarks(ctx.signal);
  watchDom(
    () => {
      const main = document.querySelector('main');
      marks.only(className, main && shows(main) ? [main] : []);
    },
    { signal: ctx.signal },
  );
}
