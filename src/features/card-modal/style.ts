import { tokens } from '@/ui/theme';

/** « Défausser » pendant la requête de défausse (verrouillé en plus, par `lockControl`). */
export const DISCARD_BUSY = 'wm-discard-busy';

export const CSS = `
/* Défausse en cours : une roue à la place de la corbeille (ou devant le texte), sans l'estompage du verrou. */
.${DISCARD_BUSY} svg.lucide-trash-2, .${DISCARD_BUSY} svg.lucide-trash2 { display: none; }
.${DISCARD_BUSY}::before { content: ''; display: inline-block; flex: none; vertical-align: middle; width: 1rem;
  height: 1rem; border: 2px solid currentColor; border-right-color: transparent; border-radius: 50%;
  animation: wm-spin 0.8s linear infinite; }
.${DISCARD_BUSY}:not(.flex):not(.inline-flex)::before { margin-right: 0.5rem; }
.${DISCARD_BUSY}.wm-site-disabled { opacity: 1 !important; }
@keyframes wm-spin { to { transform: rotate(360deg); } }

/* Éléments du site masqués (jamais retirés : React les gère). */
.wm-hidden { display: none !important; }

/* Actions : Vendre (vert) · Marché (gris) · Défausser (rouge) : couleurs de site-buttons pour ceux du site. */
.wm-root .wm-market-button[aria-pressed="true"] { border-color: ${tokens.foreground}; color: ${tokens.foreground}; }
`;
