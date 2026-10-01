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
  accentLight: 'var(--color-accent-light, #f0c75e)',
  accentForeground: 'var(--color-accent-foreground, #0d1117)',
  heading: 'var(--font-heading, inherit)',
  /** Hauteur du champ standard du site (≈ 45 px), posée sur la page par `site-fields`. */
  fieldHeight: 'var(--wm-field-height, 45px)',
  /** Fond des modales du site (`bg-black/70 backdrop-blur-sm`, 8 px en Tailwind v4), aussi celui des nôtres. */
  backdrop: 'rgb(0 0 0 / 70%)',
  backdropBlur: 'blur(8px)',
  danger: '#f85149',
  success: '#3fb950',
  warning: '#d29922',
  info: '#58a6ff',
} as const;

/**
 * Palette Tailwind v4, celle du site pour ce que son thème n'a pas (rouge, bleu, ambre…) : 300 ou 400 pour le
 * texte, 500 pour les traits et les fonds, 600 au survol d'un fond.
 */
export const palette = {
  red: { 400: 'oklch(70.4% 0.191 22.216)', 500: 'oklch(63.7% 0.237 25.331)', 600: 'oklch(57.7% 0.245 27.325)' },
  emerald: { 400: 'oklch(76.5% 0.177 163.223)', 500: 'oklch(69.6% 0.17 162.48)' },
  sky: { 400: 'oklch(74.6% 0.16 232.661)', 500: 'oklch(68.5% 0.169 237.323)' },
  blue: { 400: 'oklch(70.7% 0.165 254.624)', 500: 'oklch(62.3% 0.214 259.815)', 600: 'oklch(54.6% 0.245 262.881)' },
  amber: {
    400: 'oklch(82.8% 0.189 84.429)',
    500: 'oklch(76.9% 0.188 70.08)',
    600: 'oklch(66.6% 0.179 58.318)',
    950: 'oklch(27.9% 0.077 45.635)',
  },
  violet: { 300: 'oklch(81.1% 0.111 293.571)', 500: 'oklch(60.6% 0.25 292.717)', 600: 'oklch(54.1% 0.281 293.009)' },
  fuchsia: { 600: 'oklch(59.1% 0.293 322.896)' },
} as const;

/**
 * Une couleur à `percent` % d'opacité (`color-mix` avec transparent), comme `couleur/xx` chez Tailwind. Le résultat
 * se voit pareil dans tous les espaces ; `space` ne change que l'écriture de la valeur calculée.
 */
export function alpha(color: string, percent: number, space: 'oklab' | 'srgb' = 'oklab'): string {
  return `color-mix(in ${space}, ${color} ${percent}%, transparent)`;
}

/**
 * Opacité d'un bouton désactivé, en cours ou non (demande de l'utilisateur : la même partout) : nos boutons
 * (`buttonClass`) comme les contrôles du site verrouillés (`lockControl`).
 */
export const DISABLED_OPACITY = 0.5;

/**
 * Plans de nos calques fixes, de bas en haut, tous au-dessus du site (ses modales sont en `z-50`, son en-tête en
 * dessous) : nos modales passent devant les fenêtres des fonctionnalités, menus et toasts devant tout.
 */
export const layers = {
  /** Contenu du site sorti de la page et posé par-dessus (encart de vérification de /pulls) : sous nos fenêtres. */
  pageOverlay: 2147480000,
  /** Fenêtre d'une fonctionnalité d'où s'ouvrent nos modales (mise aux enchères : l'historique des ventes passe dessus). */
  window: 2147481000,
  /** Nos modales (`Modal`, confirmations). */
  modal: 2147482000,
  /** Menus déroulants (`Listbox`), au-dessus des modales. */
  menu: 2147482500,
  /** Toasts, tout en haut. */
  toast: 2147483000,
} as const;

/**
 * Conteneur transparent pour la mise en page (`display: contents`, `mountUi` avec `inline`) : ses enfants se placent
 * comme des enfants directs de son parent.
 */
export const INLINE_CLASS = 'wm-inline';

// Les conteneurs « inline » glissent nos contrôles dans une rangée du site : aucun style de base ne doit
// s'y appliquer, sinon il écraserait sa mise en page.
const BASE_CSS = `
.${INLINE_CLASS} { display: contents; }
.wm-root:not(.${INLINE_CLASS}), .wm-root:not(.${INLINE_CLASS}) *, .wm-root:not(.${INLINE_CLASS}) *::before,
.wm-root:not(.${INLINE_CLASS}) *::after { box-sizing: border-box; }
.wm-root:not(.${INLINE_CLASS}) { color: ${tokens.foreground}; font-family: inherit; line-height: 1.4; }
@keyframes wm-spin { to { transform: rotate(360deg); } }
@keyframes wm-fade-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
.wm-spin { animation: wm-spin 0.8s linear infinite; }
`;

/** Styles communs à toutes nos interfaces, posés une fois. */
export function ensureBaseStyle(): void {
  injectStyle('ui-base', BASE_CSS);
}
