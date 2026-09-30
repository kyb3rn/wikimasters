import { injectStyle, setClass } from '@/core/dom';
import { tokens } from './theme';

/**
 * Boutons du script et du site, tous faits ici : forme, couleur, remplissage et taille. Les mesures sont celles des
 * boutons du site (son « Défausser », sa croix de modale…), les couleurs celles de sa palette : son thème (vert,
 * gris), son rouge, son dégradé PRO, le reste de Tailwind v4 comme lui. Tout est dans notre feuille de style, hors
 * des couches de Tailwind : elle l'emporte sur les classes d'un bouton du site qu'on habille (`applyButtonClass`).
 */
export type ButtonShape = 'standard' | 'window' | 'wide' | 'square' | 'round';
/** Gris, rouge, bleu, vert (l'accent du site), ambre, mauve dégradé (PRO). */
export type ButtonTone = 'neutral' | 'danger' | 'info' | 'accent' | 'warning' | 'pro';
/** Plein, contour, ou `ghost` : la couleur du texte seule, le fond teinté au survol. */
export type ButtonFill = 'solid' | 'outline' | 'ghost';
/** Hauteurs communes à toutes les formes : grand 48 px, moyen = champs (≈ 45 px), petit 30 px. */
export type ButtonSize = 'lg' | 'md' | 'sm';

export interface ButtonStyle {
  readonly tone?: ButtonTone;
  readonly fill?: ButtonFill;
  readonly size?: ButtonSize;
}

export const BUTTON_SHAPES: readonly ButtonShape[] = ['standard', 'window', 'wide', 'square', 'round'];
export const BUTTON_TONES: readonly ButtonTone[] = ['neutral', 'danger', 'info', 'accent', 'warning', 'pro'];
export const BUTTON_FILLS: readonly ButtonFill[] = ['solid', 'outline', 'ghost'];
export const BUTTON_SIZES: readonly ButtonSize[] = ['lg', 'md', 'sm'];

// Palette Tailwind v4 : 300 ou 400 pour le texte, 500 pour les traits et les fonds, 600 au survol d'un fond.
const RED_500 = 'oklch(63.7% 0.237 25.331)';
const RED_600 = 'oklch(57.7% 0.245 27.325)';
const BLUE_400 = 'oklch(70.7% 0.165 254.624)';
const BLUE_500 = 'oklch(62.3% 0.214 259.815)';
const BLUE_600 = 'oklch(54.6% 0.245 262.881)';
const AMBER_400 = 'oklch(82.8% 0.189 84.429)';
const AMBER_500 = 'oklch(76.9% 0.188 70.08)';
const AMBER_600 = 'oklch(66.6% 0.179 58.318)';
const AMBER_950 = 'oklch(27.9% 0.077 45.635)';
const VIOLET_300 = 'oklch(81.1% 0.111 293.571)';
const VIOLET_500 = 'oklch(60.6% 0.25 292.717)';
const PRO_GRADIENT = 'linear-gradient(to right, oklch(54.1% 0.281 293.009), oklch(59.1% 0.293 322.896))';

const mix = (color: string, percent: number) => `color-mix(in oklab, ${color} ${percent}%, transparent)`;

interface Tone {
  /** Contour et ghost : texte, texte au survol, trait, fond au survol. */
  readonly text: string;
  readonly hot: string;
  readonly line: string;
  readonly wash: string;
  /** Plein : fond, fond au survol, texte. */
  readonly fill: string;
  readonly fillHover: string;
  readonly on: string;
}

/** Une couleur du site : texte, trait et fond du survol tirés de sa teinte. */
const hue = (text: string, base: string, fill: string, fillHover: string, on: string): Tone => ({
  text,
  hot: text,
  line: mix(base, 45),
  wash: mix(base, 12),
  fill,
  fillHover,
  on,
});

const tones = (): Readonly<Record<ButtonTone, Tone>> => ({
  // Contour : son bouton gris (« Défausser » de la modale de carte) ; ghost : ses ronds (croix, son coupé).
  neutral: {
    text: mix(tokens.foreground, 70),
    hot: tokens.foreground,
    line: tokens.border,
    wash: tokens.surfaceLight,
    fill: tokens.surfaceLight,
    fillHover: tokens.border,
    on: tokens.foreground,
  },
  // Plein : le « Défausser » de ses confirmations.
  danger: hue(tokens.danger, tokens.danger, RED_500, RED_600, '#fff'),
  info: hue(BLUE_400, BLUE_500, BLUE_500, BLUE_600, '#fff'),
  // Plein : ses boutons verts (« Lancer l'enchère ») ; ghost : son bouton du son allumé.
  accent: hue(tokens.accent, tokens.accent, tokens.accent, tokens.accentLight, tokens.accentForeground),
  warning: hue(AMBER_400, AMBER_500, AMBER_500, AMBER_600, AMBER_950),
  // Plein : son bouton du pack PRO (dégradé violet → fuchsia, plus clair au survol).
  pro: hue(VIOLET_300, VIOLET_500, PRO_GRADIENT, PRO_GRADIENT, '#fff'),
});

/*
 * Mesures, en rem comme Tailwind. Une taille = une hauteur, pour toutes les formes (carrés et ronds compris) : grand =
 * ses gros boutons (« Continuer » des paquets, px-8 py-3, texte de base) et les flèches du carrousel (w-12) ; moyen =
 * ses champs (son « Défausser », px-4 text-sm, allongé de 3 px pour s'aligner sur eux) ; petit = ses pastilles de
 * durée (px-3 py-1.5 text-xs).
 */
const LG = '3rem';
const MD = tokens.fieldHeight;
const SM = 'calc(1.75rem + 2px)';
const HEIGHTS: Readonly<Record<ButtonSize, string>> = { lg: LG, md: MD, sm: SM };

const buildCss = () => `
.wm-button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-width: 0;
  min-height: 0; border-width: 1px; border-style: solid; border-radius: 0.5rem; font-family: inherit; font-weight: 500;
  text-decoration: none; cursor: pointer; color: var(--wm-text); border-color: var(--wm-line); background: transparent;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s, filter 0.15s, opacity 0.15s; }
.wm-button:hover:not(:disabled) { color: var(--wm-hot); background: var(--wm-wash); }
.wm-button:focus-visible { outline: 2px solid ${mix(tokens.accent, 60)}; outline-offset: 2px; }
.wm-button:disabled { opacity: 0.5; cursor: not-allowed; }
.wm-button.wm-solid { color: var(--wm-on); border-color: transparent; background: var(--wm-fill); font-weight: 600; }
.wm-button.wm-solid:hover:not(:disabled) { color: var(--wm-on); background: var(--wm-fill-hover); }
.wm-button.wm-tone-pro.wm-solid:hover:not(:disabled) { filter: brightness(1.1); }
.wm-button.wm-ghost { border-color: transparent; }

.wm-button-lg { gap: 0.5rem; padding: calc((${LG} - 1.5rem - 2px) / 2) 1.5rem; font-size: 1rem; line-height: 1.5rem; }
.wm-button-md { gap: 0.5rem; padding: calc((${MD} - 1.25rem - 2px) / 2) 1rem; font-size: 0.875rem; line-height: 1.25rem; }
.wm-button-sm { gap: 0.375rem; padding: calc((${SM} - 1rem - 2px) / 2) 0.75rem; font-size: 0.75rem; line-height: 1rem; }
.wm-button:is(.wm-button-standard, .wm-button-window, .wm-button-wide) { height: auto; }
.wm-button-window { flex: 1 1 0%; }
.wm-button-wide { width: 100%; }
.wm-button:is(.wm-button-square, .wm-button-round) { flex-shrink: 0; padding: 0; }
.wm-button-round { border-radius: 9999px; }
${BUTTON_SIZES.map(
  (size) => `.wm-button:is(.wm-button-square, .wm-button-round).wm-button-${size} { width: ${HEIGHTS[size]}; height: ${HEIGHTS[size]}; }`,
).join('\n')}
${Object.entries(tones())
  .map(
    ([name, tone]) =>
      `.wm-tone-${name} { --wm-text: ${tone.text}; --wm-hot: ${tone.hot}; --wm-line: ${tone.line}; --wm-wash: ${tone.wash}; ` +
      `--wm-fill: ${tone.fill}; --wm-fill-hover: ${tone.fillHover}; --wm-on: ${tone.on}; }`,
  )
  .join('\n')}
`;

let css: string | undefined;

function ensureCss(): void {
  css ??= buildCss();
  injectStyle('ui-button', css);
}

function tokensOf(shape: ButtonShape, { tone = 'neutral', fill = 'outline', size = 'md' }: ButtonStyle): string[] {
  return ['wm-button', `wm-button-${shape}`, `wm-button-${size}`, `wm-tone-${tone}`, ...(fill === 'outline' ? [] : [`wm-${fill}`])];
}

/** Classes d'un bouton : sa forme, puis sa couleur, son remplissage et sa taille (gris, contour, moyen par défaut). */
export function buttonClass(shape: ButtonShape, style: ButtonStyle = {}): string {
  ensureCss();
  return tokensOf(shape, style).join(' ');
}

/** Nos classes de bouton (`buttonClass`), à distinguer de celles du site. */
const isButtonClass = (name: string): boolean => /^wm-(button|tone-|solid$|ghost$)/.test(name);

/**
 * Habille un bouton du site (ou le rhabille) : nos classes voulues posées, les autres retirées. Idempotent : rien
 * n'est écrit si le bouton est déjà comme il faut (rappel de `watchDom`). `undefined` : rendu à son allure d'origine.
 */
export function applyButtonClass(element: Element, shape: ButtonShape | undefined, style: ButtonStyle = {}): void {
  const wanted = new Set(shape ? tokensOf(shape, style) : []);
  if (shape) ensureCss();
  for (const name of [...element.classList]) if (isButtonClass(name) && !wanted.has(name)) setClass(element, name, false);
  for (const name of wanted) setClass(element, name, true);
}
