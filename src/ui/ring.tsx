import { injectStyle } from '@/core/dom';

/**
 * Couleurs des cadres de carte : vert, bleu, rose (paliers des bonnes affaires du marché, entre lesquels leur couleur
 * glisse). Un cadre vert est ce vert-là.
 */
export const RING_COLORS = { green: '#4ee329', blue: '#00c3ff', pink: '#ff00ea' } as const;

export const CARD_RING = 'wm-card-ring';

/*
 * Contour décalé de 1 px autour d'un bloc arrondi de 16 px (face, vignette du marché). Au survol, une face du site
 * grandit de 5 % : le cadre posé juste après elle grandit avec elle, au même rythme, sinon elle passerait dessus.
 */
const CSS = `
.${CARD_RING} { position: absolute; inset: -3px; z-index: 2; border: 2px solid; border-radius: 19px; pointer-events: none;
  transition: transform 0.3s; }
.hover\\:scale-105:hover + .${CARD_RING} { transform: scale(1.05); }
`;

/**
 * Cadre de couleur autour d'une carte : toute bordure de couleur sur une carte passe par ici (même trait, même écart
 * partout). Posé dans un parent positionné de la taille de la carte ; en tirets : signal moins sûr.
 */
export function CardRing({ color, dashed = false }: { readonly color: string; readonly dashed?: boolean }) {
  injectStyle('ui-card-ring', CSS);
  return <span class={CARD_RING} style={{ borderColor: color, borderStyle: dashed ? 'dashed' : 'solid' }} aria-hidden="true" />;
}
