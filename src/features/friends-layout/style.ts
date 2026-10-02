import { tokens } from '@/ui/theme';

/** Section « Amis (n) » : sa liste en grille. */
export const LIST = 'wm-friends-list';
/** Sections des demandes en attente (reçues, envoyées) : même grille. */
export const REQUESTS = 'wm-friends-requests';
/** Demande reçue : fond des autres lignes (amis, demandes envoyées) au lieu de la teinte accent du site. */
export const INCOMING = 'wm-friends-incoming';
/** Cadre du champ de recherche des amis : le champ à gauche, nos deux boutons à droite. */
export const SEARCH = 'wm-friends-search';
/** Nos deux boutons du cadre de recherche. */
export const ACTION = 'wm-friends-action';
/** Cadre de la liste vide (« Vous n'avez pas encore d'amis. »). */
export const EMPTY = 'wm-friends-empty';
/** « Inviter » de la liste vide, à gauche de son « Rechercher des joueurs » (renommé « Ajouter un ami »). */
export const EMPTY_INVITE = 'wm-friends-empty-invite';

/** Largeur minimale d'une ligne (ami ou demande) avant de passer à une colonne de moins. */
const MIN_WIDTH = '510px';

/*
 * Listes : trois colonnes tant que chaque ligne garde 510 px, puis deux, puis une seule en pleine largeur (grille
 * `auto-fill` : la largeur minimale d'une colonne est le tiers de la ligne tant qu'il dépasse 510 px, d'où trois
 * au plus ; 0,1 px de marge contre les arrondis). Le reste sur toute la largeur : titres, « Tout accepter »,
 * recherche, messages (« Aucun résultat… »). Lignes reconnues en CSS, sans attendre le script : un ami a le lien
 * de son profil, une demande le paragraphe de son pseudo. Les fenêtres Message / Échanger rendues entre les
 * lignes sont en `fixed`, hors de la grille.
 *
 * Recherche (« level » : deux côtés sans rapport) : le champ à gauche, 25 rem au plus, les boutons à droite, un
 * vide entre les deux. La croix d'effacement du site (`absolute`) est placée dans la case du champ, qui devient
 * sa référence (lignes de début et de fin explicites : pour un élément `absolute`, une fin `auto` irait jusqu'au
 * bord de la grille). Sous 640 px (le `sm` du site) : les boutons passent sous le champ, à droite.
 *
 * Liste vide : « Inviter » et « Ajouter un ami » (son « Rechercher des joueurs ») côte à côte, centrés par le
 * `text-center` du cadre. Alignés par le haut, Inviter avec la même marge que le `mt-2` du bouton du site (sur la
 * ligne de base, l'icône d'Inviter le décalerait de 3 px).
 */
export const CSS = `
:is(.${LIST}, .${REQUESTS}) { display: grid; gap: 0.75rem;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, max(${MIN_WIDTH}, (100% - 1.5rem) / 3 - 0.1px)), 1fr)); }
:is(.${LIST}, .${REQUESTS}) > * { margin-block: 0; }
.${REQUESTS} > .${INCOMING} { background-color: ${tokens.surfaceLight}; border-width: 0; }
.${LIST} > :not(:has(> a[href^="/profile/"])),
.${REQUESTS} > :not(div:has(> p)) { grid-column: 1 / -1; }

.${SEARCH} { display: grid; grid-template-columns: minmax(10rem, 25rem) 1fr auto auto; gap: 0.5rem; }
.${SEARCH} > input, .${SEARCH} > button { grid-area: 1 / 1 / 2 / 2; }
.${SEARCH} .${ACTION} { grid-row: 1; grid-column: 3; white-space: nowrap; }
.${SEARCH} .${ACTION} + .${ACTION} { grid-column: 4; }
@media (max-width: 639.98px) {
  .${SEARCH} { grid-template-columns: 1fr auto auto; }
  .${SEARCH} > input, .${SEARCH} > button { grid-column: 1 / -1; }
  .${SEARCH} .${ACTION} { grid-row: 2; grid-column: 2; }
  .${SEARCH} .${ACTION} + .${ACTION} { grid-column: 3; }
}

.${EMPTY} > button, .${EMPTY_INVITE} { vertical-align: top; }
.${EMPTY_INVITE} { margin: 0.5rem 0.5rem 0 0; }
`;
