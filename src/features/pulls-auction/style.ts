/** Modale de carte ouverte par l'enchère rapide : cachée, seule la mise en vente se voit. */
export const HOST_HIDDEN = 'wm-quick-auction-host';

export const CSS = `
/* Ouverture en cours : roue à pleine opacité (le bouton est désactivé, pas estompé). */
.wm-root .wm-auction-quick[data-status="busy"] { opacity: 1; }

.${HOST_HIDDEN} { visibility: hidden !important; pointer-events: none !important; }
`;
