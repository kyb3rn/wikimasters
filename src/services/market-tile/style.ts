import { injectStyle } from '@/core/dom';
import { OWN_TIME, TILE, TILE_FACE, TILE_LINK } from '@/site/marketplace';
import { alpha, tokens } from '@/ui/theme';

/** Face `sm` des grilles du site (`w-[clamp(8.4rem,43vw,10rem)] h-[clamp(11.8rem,60vw,14rem)]`). */
const FACE_WIDTH = 'clamp(8.4rem, 43vw, 10rem)';
const FACE_HEIGHT = 'clamp(11.8rem, 60vw, 14rem)';
/**
 * Hauteur du cadre cachée sous la carte : au moins deux rayons d'arrondi (16 px), pour que les coins du cadre
 * restent sous la carte et que seuls ses côtés droits apparaissent dans les coins arrondis de la carte.
 */
const TUCK = '32px';

const COLUMN = `${TILE_LINK} > div`;
/** Rangée prix · durée : deux colonnes (libellé, valeur). */
const PRICE = `${COLUMN} > div.w-full`;
/** Compte à rebours du site resté affiché (fin de l'enchère illisible) : `TILE_ENDED` quand il dit « Terminée ». */
const SITE_TIME = `${PRICE} > div:last-child > span:last-child:not(.${OWN_TIME})`;
export const TILE_ENDED = 'wm-tile-ended';
/** Notre temps restant, aussi précis que les règles de la rangée pour l'emporter sur elles. */
const OWN = `${PRICE} > div span.${OWN_TIME}`;

/*
 * Carte standardisée du marché. Le cadre du site (`a.card-frame`) reste le lien et le fond de l'appendice ; il commence
 * sous la carte, que l'on remonte au-dessus de lui : seuls la mise et la durée (et « Vous menez » / « Surenchéri »,
 * passé sous la carte) sont dans le cadre. Le vendeur est sur l'image de la carte (player-links).
 *
 * Dans l'appendice, libellés discrets au-dessus des valeurs, valeurs à la même taille sur une ligne commune.
 * « Mise de départ » en majuscules espacées ne tiendrait pas à côté de la durée dans la largeur de la carte :
 * libellés en minuscules, icône du marteau retirée de « Durée ».
 *
 * Temps restant : court (« 2h ») et précis (« 2:07:28 ») au survol de la vignette ; plus petit et plus léger que la
 * mise, un ton en dessous (l'ambre des 5 dernières minutes reste) ; « Terminée » s'efface, sans changer la hauteur.
 */
const css = () => `
${TILE_LINK} { box-sizing: border-box; width: ${FACE_WIDTH}; margin-top: calc(${FACE_HEIGHT} - ${TUCK});
  padding: 0 9px 8px; }
${TILE_FACE} { order: -1; position: relative; z-index: 1; overflow: visible;
  margin-top: calc(${TUCK} - ${FACE_HEIGHT} - 1px); margin-bottom: 9px; }
${TILE} { position: relative; }
${COLUMN} { gap: 0; }
${COLUMN} > span { margin-bottom: 8px; padding-block: 3px; }

${PRICE} { align-items: flex-end; gap: 8px; }
${PRICE} > div { gap: 1px; min-width: 0; }
${PRICE} > div > span:first-child { font-size: 10px; line-height: 13px; text-transform: none; letter-spacing: 0;
  white-space: nowrap; }
${PRICE} > div > span:first-child > svg { display: none; }
${PRICE} > div > span:last-child { font-size: 13px; line-height: 18px; font-weight: 600; white-space: nowrap; }
${PRICE} > div:first-child > span { max-width: 100%; overflow: hidden; text-overflow: ellipsis; }

${SITE_TIME}, ${OWN} { font-variant-numeric: tabular-nums; font-size: 12px; line-height: 18px; font-weight: 400;
  white-space: nowrap; }
${SITE_TIME}:not([class*="amber"]), ${OWN}[data-state="running"] {
  color: ${alpha(tokens.foreground, 80, 'srgb')}; }
${SITE_TIME}.${TILE_ENDED}, ${OWN}[data-state="ended"] { font-size: 11px; font-style: italic; font-weight: 400;
  color: ${alpha(tokens.foreground, 55, 'srgb')}; }
.${OWN_TIME}-precise { display: none; }
${TILE}:hover .${OWN_TIME}-short { display: none; }
${TILE}:hover .${OWN_TIME}-precise { display: inline; }
`;

/** Feuille de la carte standardisée du marché : vignettes du site comme les nôtres (recherche avancée). */
export function ensureMarketTileStyle(): void {
  injectStyle('market-tile', css());
}
