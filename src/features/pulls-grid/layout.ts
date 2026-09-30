/** Face « lg » du site (`w-72 h-[420px]`), celle du carrousel. */
export const CARD_WIDTH = 288;
export const CARD_HEIGHT = 420;
export const GAP_X = 20;
export const GAP_Y = 24;
/** Sous chaque carte : l'espace et les boutons ronds (moyens : hauteur des champs, 45 px) du défaussage et de l'enchère rapides. */
export const ACTIONS_GAP = 12;
const ACTIONS_HEIGHT = ACTIONS_GAP + 45;
const MAX_COLUMNS = 5;
/** Plus petit que ça, les cartes ne se lisent plus : on garde cette taille et la page défile. */
const MIN_ZOOM = 0.6;

export interface GridLayout {
  readonly columns: number;
  /** Échelle des cartes (1 = taille du carrousel). */
  readonly zoom: number;
  /** Largeur de la grille (px) : les lignes se coupent d'elles-mêmes après `columns` cartes. */
  readonly width: number;
}

/**
 * Lignes de cinq cartes au plus, à la taille du carrousel si elles tiennent dans `width` × `height`,
 * sinon réduites (jusqu'à `MIN_ZOOM`). Trop étroit même réduit : moins de cartes par ligne.
 */
export function gridLayout(count: number, width: number, height: number): GridLayout {
  const most = Math.min(MAX_COLUMNS, Math.max(1, count));
  for (let columns = most; columns >= 1; columns--) {
    const byWidth = (width - (columns - 1) * GAP_X) / (columns * CARD_WIDTH);
    if (byWidth < MIN_ZOOM && columns > 1) continue;
    const rows = Math.ceil(count / columns);
    const byHeight = (height - rows * ACTIONS_HEIGHT - (rows - 1) * GAP_Y) / (rows * CARD_HEIGHT);
    const zoom = Math.floor(Math.max(0.2, Math.min(1, byWidth, Math.max(MIN_ZOOM, byHeight))) * 1000) / 1000;
    return { columns, zoom, width: Math.ceil(columns * CARD_WIDTH * zoom + (columns - 1) * GAP_X) + 1 };
  }
  return { columns: 1, zoom: 1, width: CARD_WIDTH + 1 };
}
