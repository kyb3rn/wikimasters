import { injectStyle, setClass } from '@/core/dom';
import { alpha, DISABLED_OPACITY, palette, tokens } from './theme';

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
/** Hauteurs communes à toutes les formes : grand 48 px, moyen = champs (≈ 45 px), petit 30 px, très petit (« tiny ») 20 px. */
export type ButtonSize = 'lg' | 'md' | 'sm' | 'xs';

export interface ButtonStyle {
  readonly tone?: ButtonTone;
  readonly fill?: ButtonFill;
  readonly size?: ButtonSize;
  /** Bords arrondis à 100 % (formes longues : standard, fenêtre, pleine largeur). */
  readonly pill?: boolean;
}

export const BUTTON_TONES: readonly ButtonTone[] = ['neutral', 'danger', 'info', 'accent', 'warning', 'pro'];
export const BUTTON_FILLS: readonly ButtonFill[] = ['solid', 'outline', 'ghost'];
export const BUTTON_SIZES: readonly ButtonSize[] = ['lg', 'md', 'sm', 'xs'];

const { red, blue, amber, violet, fuchsia } = palette;
/** Posé depuis le bord extérieur (`border-box` des pleins) : sinon il se répète sous la bordure transparente (liseré fuchsia à gauche). */
const PRO_GRADIENT = `linear-gradient(to right, ${violet[600]}, ${fuchsia[600]})`;

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
  line: alpha(base, 45),
  wash: alpha(base, 12),
  fill,
  fillHover,
  on,
});

const tones = (): Readonly<Record<ButtonTone, Tone>> => ({
  // Contour : son bouton gris (« Défausser » de la modale de carte) ; ghost : ses ronds (croix, son coupé).
  neutral: {
    text: alpha(tokens.foreground, 70),
    hot: tokens.foreground,
    line: tokens.border,
    wash: tokens.surfaceLight,
    fill: tokens.surfaceLight,
    fillHover: tokens.border,
    on: tokens.foreground,
  },
  // Plein : le « Défausser » de ses confirmations.
  danger: hue(tokens.danger, tokens.danger, red[500], red[600], '#fff'),
  info: hue(blue[400], blue[500], blue[500], blue[600], '#fff'),
  // Plein : ses boutons verts (« Lancer l'enchère ») ; ghost : son bouton du son allumé.
  accent: hue(tokens.accent, tokens.accent, tokens.accent, tokens.accentLight, tokens.accentForeground),
  warning: hue(amber[400], amber[500], amber[500], amber[600], amber[950]),
  // Plein : son bouton du pack PRO (dégradé violet → fuchsia, plus clair au survol).
  pro: hue(violet[300], violet[500], PRO_GRADIENT, PRO_GRADIENT, '#fff'),
});

/*
 * Mesures, en rem comme Tailwind. Une taille = une hauteur, pour toutes les formes (carrés et ronds compris) : grand =
 * ses gros boutons (« Continuer » des paquets, px-8 py-3, texte de base) et les flèches du carrousel (w-12) ; moyen =
 * ses champs (son « Défausser », px-4 text-sm, allongé de 3 px pour s'aligner sur eux) ; petit = ses pastilles de
 * durée (px-3 py-1.5 text-xs) ; très petit = notre « @pseudo » posé sur l'image d'une carte (texte 10 px, arrondi 6 px), qui
 * ne doit pas la masquer.
 */
const LG = '3rem';
const MD = tokens.fieldHeight;
const SM = 'calc(1.75rem + 2px)';
const XS = '1.25rem';
const HEIGHTS: Readonly<Record<ButtonSize, string>> = { lg: LG, md: MD, sm: SM, xs: XS };

const buildCss = () => `
.wm-button { box-sizing: border-box; display: inline-flex; align-items: center; justify-content: center; min-width: 0;
  min-height: 0; border-width: 1px; border-style: solid; border-radius: 0.5rem; font-family: inherit; font-weight: 500;
  text-decoration: none; cursor: pointer; color: var(--wm-text); border-color: var(--wm-line); background: transparent;
  transition: color 0.15s, background-color 0.15s, border-color 0.15s, filter 0.15s, opacity 0.15s; }
.wm-button:hover:not(:disabled) { color: var(--wm-hot); background: var(--wm-wash); }
.wm-button:focus-visible { outline: 2px solid ${alpha(tokens.accent, 60)}; outline-offset: 2px; }
.wm-button:disabled { opacity: ${DISABLED_OPACITY}; cursor: not-allowed; }
.wm-button.wm-solid { color: var(--wm-on); border-color: transparent; background: var(--wm-fill) border-box; font-weight: 600; }
.wm-button.wm-solid:hover:not(:disabled) { color: var(--wm-on); background: var(--wm-fill-hover) border-box; }
.wm-button.wm-tone-pro.wm-solid:hover:not(:disabled) { filter: brightness(1.1); }
.wm-button.wm-ghost { border-color: transparent; }
.wm-button.wm-pill { border-radius: 9999px; }

.wm-button-lg { gap: 0.5rem; padding: calc((${LG} - 1.5rem - 2px) / 2) 1.5rem; font-size: 1rem; line-height: 1.5rem; }
.wm-button-md { gap: 0.5rem; padding: calc((${MD} - 1.25rem - 2px) / 2) 1rem; font-size: 0.875rem; line-height: 1.25rem; }
.wm-button-sm { gap: 0.375rem; padding: calc((${SM} - 1rem - 2px) / 2) 0.75rem; font-size: 0.75rem; line-height: 1rem; }
.wm-button-xs { gap: 0.25rem; padding: calc((${XS} - 0.875rem - 2px) / 2) 0.4375rem; font-size: 0.625rem; line-height: 0.875rem;
  border-radius: 0.375rem; }
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

function tokensOf(shape: ButtonShape, { tone = 'neutral', fill = 'outline', size = 'md', pill = false }: ButtonStyle): string[] {
  return [
    'wm-button',
    `wm-button-${shape}`,
    `wm-button-${size}`,
    `wm-tone-${tone}`,
    ...(fill === 'outline' ? [] : [`wm-${fill}`]),
    ...(pill ? ['wm-pill'] : []),
  ];
}

/** Classes d'un bouton : sa forme, puis sa couleur, son remplissage, sa taille (gris, contour, moyen par défaut) et son arrondi. */
export function buttonClass(shape: ButtonShape, style: ButtonStyle = {}): string {
  ensureCss();
  return tokensOf(shape, style).join(' ');
}

/** Nos classes de bouton (`buttonClass`), à distinguer de celles du site. */
const isButtonClass = (name: string): boolean => /^wm-(button|tone-|solid$|ghost$|pill$)/.test(name);

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
