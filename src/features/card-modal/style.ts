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

/* « Signaler l'image » sur l'image de la carte, en bas à droite. */
.wm-report { position: absolute; right: 8px; bottom: 8px; z-index: 35; display: flex; align-items: center;
  justify-content: center; width: 30px; height: 30px; padding: 0; border-radius: 999px;
  border: 1px solid rgb(255 255 255 / 18%); background: rgb(0 0 0 / 55%); color: #fff; cursor: pointer;
  backdrop-filter: blur(2px); transition: background 0.15s, color 0.15s; }
.wm-report:hover:not(:disabled) { background: rgb(0 0 0 / 78%); }
.wm-report[aria-pressed="true"] { color: ${tokens.danger}; }
.wm-report:disabled { opacity: 0.45; cursor: not-allowed; }

/* Actions : Vendre · Marché (gris) · Défausser (rouge). */
.wm-root .wm-market-button { gap: 0.5rem; }
.wm-root .wm-market-button[aria-pressed="true"] { border-color: ${tokens.foreground}; color: ${tokens.foreground}; }
.wm-danger { color: ${tokens.danger} !important; border-color: rgb(248 81 73 / 45%) !important; }
.wm-danger:hover:not(:disabled) { background: rgb(248 81 73 / 12%) !important; }
`;
