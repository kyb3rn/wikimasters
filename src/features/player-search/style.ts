/** Cadre de la fenêtre « Rechercher un joueur ». */
export const FRAME = 'wm-player-search';
/** Zone des résultats : roue, messages, lignes des joueurs. */
export const RESULTS = 'wm-player-search-results';
/** Notre champ et sa loupe, à la place du champ du site (recherche à Entrée). */
export const BAR = 'wm-player-search-bar';
/** Loupe de notre champ (repère des tests). */
export const BUTTON = 'wm-player-search-button';

/*
 * Fenêtre de 896 px (56 rem : 420 px par ligne de joueur sur deux colonnes). Résultats sur deux colonnes, assez
 * hauts pour cinq rangées de lignes de 56 px, soit dix joueurs sans défilement ; une seule colonne sous 640 px (le
 * `sm` du site). La roue et les messages (« Aucun joueur trouvé »…) n'ont pas de bouton : toute la largeur. L'écart
 * vertical de `space-y-2` (`:where`, sans poids) cède à celui de la grille ; `div.` passe devant la largeur et la
 * hauteur du site. Pseudo trop long : coupé (…), jamais les boutons (« Demande envoyée » sur une ligne).
 */
export const CSS = `
div.${FRAME} { max-width: 56rem; }
div.${RESULTS} { height: 19.5rem; display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 0.5rem;
  align-content: start; }
.${RESULTS} > * { margin-block: 0; }
.${RESULTS} > :not(:has(> button)) { grid-column: 1 / -1; }
.${RESULTS} > div > span.flex-1 { min-width: 0; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
.${RESULTS} > div > button { flex-shrink: 0; white-space: nowrap; }
@media (max-width: 639.98px) {
  div.${RESULTS} { grid-template-columns: minmax(0, 1fr); }
}

.${BAR} { display: flex; gap: 0.5rem; }
.${BAR} > input { flex: 1; min-width: 0; }
`;
