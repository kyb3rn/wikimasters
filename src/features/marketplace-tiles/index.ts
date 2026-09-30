import { injectStyle, setClass, watchDom, whenBody } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { findTileDurations, TILE, TILE_FACE, TILE_LINK } from '@/site/marketplace';
import { tokens } from '@/ui/theme';

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
const ENDED = 'wm-tile-ended';

/*
 * Le cadre du site (`a.card-frame`) reste le lien et le fond de l'appendice ; il commence sous la carte, que
 * l'on remonte au-dessus de lui : seuls la mise et la durée (et « Vous menez » / « Surenchéri », passé sous la
 * carte) sont dans le cadre. Le vendeur est sur l'image de la carte (player-links).
 *
 * Dans l'appendice, libellés discrets au-dessus des valeurs, valeurs à la même taille sur une ligne commune.
 * « Mise de départ » en majuscules espacées ne tiendrait pas à côté de la durée dans la largeur de la carte :
 * libellés en minuscules, icône du marteau retirée de « Durée ».
 */
const CSS = `
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
${PRICE} > div:last-child > span:last-child { font-variant-numeric: tabular-nums; font-weight: 500; }
/* Durée un ton sous la mise ; l'ambre du site (moins de 5 min) reste. */
${PRICE} > div:last-child > span:last-child:not([class*="amber"]) {
  color: color-mix(in srgb, ${tokens.foreground} 80%, transparent); }
/* « Terminée » : s'efface, sans changer la hauteur de la ligne. */
${PRICE} > div:last-child > span:last-child.${ENDED} { font-size: 11px; font-style: italic; font-weight: 400;
  color: color-mix(in srgb, ${tokens.foreground} 55%, transparent); }
`;

export const marketplaceTiles: Feature = {
  id: 'marketplace-tiles',
  name: 'Annonces',
  description: 'Marché : cartes des annonces sans cadre, la mise et la durée dans un appendice sous la carte.',
  category: 'Marché',
  routes: ['/marketplace'],
  required: true,
  hidden: true,
  async mount(ctx) {
    await whenBody();
    if (ctx.signal.aborted) return;
    injectStyle('marketplace-tiles', CSS);
    const markEnded = () => {
      for (const { element, ended } of findTileDurations()) setClass(element, ENDED, ended);
    };
    watchDom(markEnded, { signal: ctx.signal });
    // Le compte à rebours ne change que son texte, que watchDom ne voit pas : arrivée à zéro relue chaque seconde.
    const timer = setInterval(markEnded, 1000);
    ctx.signal.addEventListener('abort', () => clearInterval(timer), { once: true });
    ctx.onDispose(() => {
      document.getElementById('wm-style-marketplace-tiles')?.remove();
      document.querySelectorAll(`.${ENDED}`).forEach((element) => element.classList.remove(ENDED));
    });
  },
};
