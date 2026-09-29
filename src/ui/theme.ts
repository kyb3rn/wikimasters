import { injectStyle } from '@/core/dom';

/**
 * Couleurs et polices du site (variables CSS de son thème), avec une valeur de repli
 * pour les pages de test qui ne les définissent pas. Nos interfaces n'utilisent que ces jetons :
 * elles suivent le thème du site sans dépendre de ses classes Tailwind.
 */
export const tokens = {
  surface: 'var(--color-surface, #161b22)',
  surfaceLight: 'var(--color-surface-light, #21262d)',
  border: 'var(--color-border, #30363d)',
  foreground: 'var(--color-foreground, #e6edf3)',
  accent: 'var(--color-accent, #e3b341)',
  accentForeground: 'var(--color-accent-foreground, #0d1117)',
  heading: 'var(--font-heading, inherit)',
  danger: '#f85149',
  success: '#3fb950',
  warning: '#d29922',
  info: '#58a6ff',
} as const;

// Les conteneurs « inline » portent des boutons qui copient les classes du site :
// aucun style de base ne doit s'y appliquer, sinon il écraserait l'allure du site.
const BASE_CSS = `
.wm-root:not(.wm-inline), .wm-root:not(.wm-inline) *, .wm-root:not(.wm-inline) *::before,
.wm-root:not(.wm-inline) *::after { box-sizing: border-box; }
.wm-root:not(.wm-inline) { color: ${tokens.foreground}; font-family: inherit; line-height: 1.4; }
@keyframes wm-spin { to { transform: rotate(360deg); } }
@keyframes wm-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.wm-spin { animation: wm-spin 0.8s linear infinite; }
`;

/** Styles communs à toutes nos interfaces, posés une fois. */
export function ensureBaseStyle(): void {
  injectStyle('ui-base', BASE_CSS);
}
