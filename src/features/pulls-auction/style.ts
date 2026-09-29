import { tokens } from '@/ui/theme';

/** Modale de carte ouverte par l'enchère rapide : cachée, seule la mise en vente se voit. */
export const HOST_HIDDEN = 'wm-quick-auction-host';

export const CSS = `
.wm-root .wm-auction-quick { color: ${tokens.success}; border-color: rgb(63 185 80 / 55%); }
.wm-root .wm-auction-quick:hover:not(:disabled) { background: rgb(63 185 80 / 12%); }
.wm-root .wm-auction-quick[data-status="busy"] { opacity: 1; }
.wm-root .wm-auction-quick[data-status="listed"] { opacity: 0.6; color: ${tokens.foreground}; border-color: ${tokens.border}; }

.${HOST_HIDDEN} { visibility: hidden !important; pointer-events: none !important; }
`;
