/**
 * Champs de saisie du site (captures et code du 29/09/2026). Il impose 16 px à tout champ
 * (`input,textarea,select{font-size:16px!important}`, contre le zoom sur iPhone) : leur hauteur tient alors
 * à leur marge et à leur hauteur de ligne. Champ standard `py-2.5 text-sm border` : 45 px ; d'autres en
 * `py-2` (41 px ; 38 px avec `leading-5`, gestion des étiquettes), ses listes déroulantes `min-h-[42px]`,
 * le code de bataille en `text-lg` (47 px). À part : renommage en ligne (`py-1`), connexion (`py-3`),
 * zones de texte sur plusieurs lignes, montants (champ sans cadre dans un cadre, déjà à 45 px).
 */

/** Hauteur du champ standard : `py-2.5`, cadre de 1 px, ligne de `text-sm` pour un texte de 16 px. */
export const FIELD_HEIGHT = 'calc(var(--spacing, 0.25rem) * 5 + 2px + 16px * var(--text-sm--line-height, 1.428571))';

/** Champs d'une ligne avec cadre, de taille normale. */
export const TEXT_FIELD =
  ':is(input:not([type]), input[type="text"], input[type="search"], input[type="number"]).border:is(.py-2, .py-2\\.5)';

export const SELECT_FIELD = 'select.border:is(.py-2, .py-2\\.5)';

/** Ses listes déroulantes (Collection, Catalogue) : bouton `aria-haspopup="listbox"` à hauteur de champ. */
export const LISTBOX_FIELD = 'button[aria-haspopup="listbox"].min-h-\\[42px\\]';

/** Bouton « Envoyer » des barres de message (messages privés, guilde), centré à droite du champ. */
export const SEND_BUTTON = `${TEXT_FIELD} + button[aria-label="Envoyer"]`;

/** Sélecteur de couleur d'étiquette (taille normale, carré de 38 px), à côté des champs de la gestion des étiquettes. */
export const COLOR_PICKER = 'label.size-\\[2\\.375rem\\]:has(> input[type="color"])';

/** Bouton « Appliquer » de la rangée du code couleur d'une étiquette (rangée centrée, bouton plus petit). */
export const HEX_ROW_BUTTON = 'div:has(> input[aria-label="Code hexadécimal"]) > button';
