import { tokens } from '@/ui/theme';

/** Section « Amis (n) » : sa liste en grille. */
export const LIST = 'wm-friends-list';
/** Sections des demandes en attente (reçues, envoyées) : même grille. */
export const REQUESTS = 'wm-friends-requests';
/** Demande reçue : fond des autres lignes (amis, demandes envoyées) au lieu de la teinte accent du site. */
export const INCOMING = 'wm-friends-incoming';
/** Cadre du champ de recherche des amis : le champ à gauche, le tri à sa droite, nos deux boutons au bout. */
export const SEARCH = 'wm-friends-search';
/** Tri de la liste, dans le cadre de recherche. */
export const SORT = 'wm-friends-sort';
/** Nos deux boutons du cadre de recherche. */
export const ACTION = 'wm-friends-action';
/** Cadre de la liste vide (« Vous n'avez pas encore d'amis. »). */
export const EMPTY = 'wm-friends-empty';
/** « Inviter » de la liste vide, à gauche de son « Rechercher des joueurs » (renommé « Ajouter un ami »). */
export const EMPTY_INVITE = 'wm-friends-empty-invite';
/** Rang d'un ami dans le tri, posé sur sa ligne. */
export const ORDER_VAR = '--wm-friend-order';

/** Largeur minimale d'une ligne (ami ou demande) avant de passer à une colonne de moins. */
const MIN_WIDTH = '510px';

/*
 * Listes : trois colonnes tant que chaque ligne garde 510 px, puis deux, puis une seule en pleine largeur (grille
 * `auto-fill` : la largeur minimale d'une colonne est le tiers de la ligne tant qu'il dépasse 510 px, d'où trois
 * au plus ; 0,1 px de marge contre les arrondis). Le reste sur toute la largeur : titres, « Tout accepter »,
 * recherche, messages (« Aucun résultat… »). Lignes reconnues en CSS, sans attendre le script : un ami a le lien
 * de son profil, une demande le paragraphe de son pseudo. Les fenêtres Message / Échanger rendues entre les
 * lignes sont en `fixed`, hors de la grille. Tri des amis : rang de chaque ligne en `order` (les nœuds de React ne
 * bougent pas) ; le reste (titre, recherche) au rang 0, avant elles.
 *
 * Recherche (« level » : deux côtés sans rapport) : le champ à gauche, 25 rem au plus, le tri juste à sa droite,
 * les boutons au bout, un vide entre les deux. La croix d'effacement du site (`absolute`) est placée dans la case
 * du champ, qui devient sa référence (lignes de début et de fin explicites : pour un élément `absolute`, une fin
 * `auto` irait jusqu'au bord de la grille). Replis selon la largeur du cadre (menu latéral ou non) : sous 42 rem,
 * le champ seul sur sa ligne, le tri et les boutons dessous ; sous 30 rem, le tri seul sur la sienne. Le cadre est
 * le conteneur de ces requêtes, pas la section : un conteneur retient les éléments `fixed` (fenêtres des lignes).
 *
 * Liste vide : « Inviter » et « Ajouter un ami » (son « Rechercher des joueurs ») côte à côte, centrés par le
 * `text-center` du cadre. Alignés par le haut, Inviter avec la même marge que le `mt-2` du bouton du site (sur la
 * ligne de base, l'icône d'Inviter le décalerait de 3 px).
 */
export const CSS = `
:is(.${LIST}, .${REQUESTS}) { display: grid; gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, max(${MIN_WIDTH}, (100% - 1.5rem) / 3 - 0.1px)), 1fr)); }
:is(.${LIST}, .${REQUESTS}) > * { margin-block: 0; }
.${LIST} > * { order: var(${ORDER_VAR}, 0); }
.${REQUESTS} > .${INCOMING} { background-color: ${tokens.surfaceLight}; border-width: 0; }
.${LIST} > :not(:has(> a[href^="/profile/"])),
.${REQUESTS} > :not(div:has(> p)) { grid-column: 1 / -1; }

.${SEARCH} { container-type: inline-size; display: grid; grid-template-columns: minmax(0, 25rem) auto 1fr auto auto; gap: 0.5rem; }
.${SEARCH} > input, .${SEARCH} > button { grid-area: 1 / 1 / 2 / 2; }
.${SEARCH} .${SORT} { grid-row: 1; grid-column: 2; width: 13rem; }
.${SEARCH} .${ACTION} { grid-row: 1; grid-column: 4; white-space: nowrap; }
.${SEARCH} .${ACTION} + .${ACTION} { grid-column: 5; }
@container (max-width: 41.99rem) {
  .${SEARCH} > input, .${SEARCH} > button { grid-column: 1 / -1; }
  .${SEARCH} .${SORT} { grid-row: 2; grid-column: 1 / 4; width: auto; max-width: 13rem; }
  .${SEARCH} .${ACTION} { grid-row: 2; }
}
@container (max-width: 29.99rem) {
  .${SEARCH} .${SORT} { grid-column: 1 / -1; max-width: none; }
  .${SEARCH} .${ACTION} { grid-row: 3; }
}

.${EMPTY} > button, .${EMPTY_INVITE} { vertical-align: top; }
.${EMPTY_INVITE} { margin: 0.5rem 0.5rem 0 0; }
`;
