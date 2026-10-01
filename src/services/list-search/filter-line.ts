import { snugSearchButtonCss } from './SearchButton';

/** Classes posées par une page sur sa ligne des filtres et ses parties. */
export interface FilterLineParts {
  /** Zone des filtres : sa largeur décide de la mise en page (son nom sert aussi de nom de conteneur). */
  readonly area: string;
  readonly line: string;
  /** Champ de recherche, ou le cadre qui le contient. */
  readonly field: string;
  readonly sort: string;
}

export interface FilterLineSizes {
  /** Base du tri sur la ligne. */
  readonly sortBasis: string;
  /** Largeur la plus petite du tri, aussi sa base quand il passe sous le champ. */
  readonly sortMin: string;
  /** Écart entre les contrôles, quand celui du site n'est pas de 12 px. */
  readonly gap?: string;
}

/** Largeur de ligne sous laquelle un champ de 300 px ne tient plus avec le reste : il passe sur sa propre rangée. */
const ONE_ROW_FROM = '960px';

/**
 * Ligne des filtres d'une liste (Toutes les cartes, Marché) comme celle de la Collection : champ, cases de rareté,
 * tri, puis le bouton de la recherche, à 8 px du tri. Trop étroite : le champ sur sa rangée, le reste dessous. Sur une
 * rangée, tout est collé à gauche comme dans la Collection : le champ part de 550 px et un côté droit vide
 * (pseudo-élément) de la même base prend le reste ; quand la ligne se réduit, champ et vide rétrécissent ensemble, le
 * champ jusqu'à 300 px.
 */
export function filterLineCss({ area, line, field, sort }: FilterLineParts, { sortBasis, sortMin, gap }: FilterLineSizes): string {
  return `
.${area} { container: ${area} / inline-size; }
.${line} { flex-direction: row; flex-wrap: wrap; align-items: stretch;${gap ? ` gap: ${gap};` : ''} }
.${line} > .${field} { flex: 1 1 100%; }
.${line} > .${sort} { flex: 1 1 ${sortMin}; }
${snugSearchButtonCss(`.${line}`)}
@container ${area} (min-width: ${ONE_ROW_FROM}) {
  .${line} { flex-wrap: nowrap; }
  .${line} > .${field} { flex: 0 1 550px; min-width: 300px; }
  .${line} > .${sort} { flex: 0 1 ${sortBasis}; min-width: ${sortMin}; }
  .${line}::after { content: ''; flex: 1 1 550px; }
}
`;
}
