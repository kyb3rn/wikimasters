import { injectStyle, ROOT_CLASS, setClass } from '@/core/dom';
import { alpha, tokens } from './theme';

/**
 * Tampon sur une face de carte du site : carte teintée et, le plus souvent, texte en diagonale (« Défaussée »,
 * « En vente »…). Toute carte grisée ou verdie par le script passe par ici (demande de l'utilisateur : même teinte et
 * même fondu partout). Dans une modale (`revealable`), un clic sur la carte retire la teinte et le texte
 * en fondu pour la revoir propre, un autre clic les remet ; cet état vit sur la face elle-même et
 * disparaît avec elle (modale refermée).
 */
export interface Stamp {
  /** Sans texte, la carte est seulement teintée (carte non cochée en sélection, enchère finie). */
  readonly label?: string;
  /** `danger` : grisée, texte rouge ; `success` : verdie, texte vert ; `neutral` : grisée, texte gris. */
  readonly tone: 'danger' | 'success' | 'neutral';
  readonly revealable?: boolean;
  /** Carte moins sombre au survol ; le texte reste tel quel. */
  readonly lightenOnHover?: boolean;
}

/**
 * Tampons communs : carte défaussée, carte mise aux enchères, enchère terminée vendue ou non ; carte seulement grisée
 * (non cochée en sélection, enchère finie dans le marché).
 */
export const STAMPS = {
  discarded: { label: 'Défaussée', tone: 'danger', lightenOnHover: true },
  listed: { label: 'En vente', tone: 'success', lightenOnHover: true },
  sold: { label: 'Vendue', tone: 'success', lightenOnHover: true },
  unsold: { label: 'Pas vendue', tone: 'neutral', lightenOnHover: true },
  greyed: { tone: 'neutral', lightenOnHover: true },
} as const satisfies Record<string, Stamp>;

const STAMPED = 'wm-stamped';
const HOVER = 'wm-stamp-hover';
/** Tampon qu'on retire : teinte et texte s'effacent en fondu avant que le texte ne quitte la page. */
const FADING = 'wm-stamp-fading';
/** La durée des faces du site (`transition-all duration-300`), qui effacent ainsi leur halo au même rythme. */
const FADE_MS = 300;
/** Retraits en cours, par face. */
const fadeTimers = new WeakMap<HTMLElement, number>();

/**
 * Teinte de chaque ton : un filtre de couleur sur la carte, jamais de transparence (demande de l'utilisateur : la carte
 * se teinte de la même façon quel que soit le fond derrière elle). Une nouvelle couleur s'ajoute ici.
 */
const TONES: Record<Stamp['tone'], { readonly tint: string; readonly text: string }> = {
  danger: { tint: 'grayscale(1)', text: tokens.danger },
  neutral: { tint: 'grayscale(1)', text: alpha(tokens.foreground, 60) },
  success: { tint: 'grayscale(1) sepia(0.6) hue-rotate(75deg) saturate(1.4)', text: tokens.success },
};
/** Luminosité d'une carte teintée, la même pour toutes les couleurs ; au survol (`lightenOnHover`), un peu moins sombre. */
const BRIGHTNESS = 0.55;
const HOVER_BRIGHTNESS = 0.8;

const toneRules = Object.entries(TONES)
  .map(([tone, { tint, text }]) => `.${STAMPED}[data-wm-tone="${tone}"] { --wm-stamp-tint: ${tint}; --wm-stamp-color: ${text}; }`)
  .join('\n');

const CSS = `
.${STAMPED}:not(.wm-stamp-revealed) { box-shadow: none !important; }
:is(.${STAMPED}, .${FADING}) > :not(.wm-stamp) { transition: filter ${FADE_MS}ms; }
${toneRules}
.${STAMPED}:not(.wm-stamp-revealed) > :not(.wm-stamp) { filter: var(--wm-stamp-tint) brightness(${BRIGHTNESS}); }
.${STAMPED}.${HOVER}:hover:not(.wm-stamp-revealed) > :not(.wm-stamp) {
  filter: var(--wm-stamp-tint) brightness(${HOVER_BRIGHTNESS}); }
.wm-stamp { position: absolute; inset: 0; z-index: 45; display: flex; align-items: center; justify-content: center;
  pointer-events: none; transition: opacity ${FADE_MS}ms; }
@starting-style { .wm-stamp { opacity: 0; } }
.wm-stamp > span { transform: rotate(-30deg); padding: 4px 14px; border: 2px solid var(--wm-stamp-color);
  border-radius: 8px; color: var(--wm-stamp-color); background: rgb(13 17 23 / 78%); font-family: ${tokens.heading};
  font-size: 18px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; }
:is(.wm-stamp-revealed, .${FADING}) > .wm-stamp { opacity: 0; }
.wm-stamp-toggle { cursor: pointer; }
`;

let installed = false;

/** Styles et clic « montrer la carte propre », une fois pour tout le script. */
function install(): void {
  if (installed) return;
  installed = true;
  injectStyle('ui-stamp', CSS);
  window.addEventListener(
    'click',
    (event) => {
      if (!(event.target instanceof Element) || event.target.closest('button')) return;
      const face = event.target.closest<HTMLElement>('.wm-stamp-toggle');
      if (!face) return;
      if (face.dataset.wmRevealed) delete face.dataset.wmRevealed;
      else face.dataset.wmRevealed = '1';
      setClass(face, 'wm-stamp-revealed', face.dataset.wmRevealed === '1');
    },
    { capture: true },
  );
}

const overlayOf = (face: HTMLElement) => face.querySelector<HTMLElement>(':scope > .wm-stamp');

/**
 * Pose, met à jour ou retire (`stamp` absent) le tampon de `owner` sur une face. Une face ne porte qu'un
 * tampon : celui d'un autre propriétaire est laissé tel quel, sauf une simple teinte, qui cède la place à un tampon
 * avec texte (son propriétaire la reposera une fois la face libre). Idempotent : n'écrit que ce qui change.
 */
export function stampFace(face: HTMLElement, owner: string, stamp: Stamp | undefined): void {
  const current = face.dataset.wmStamp;
  if (current && current !== owner) {
    if (!stamp?.label || overlayOf(face)) return;
    unstamp(face);
  }
  if (!stamp) {
    if (current === owner) unstamp(face);
    return;
  }
  install();
  stopFading(face);
  if (face.dataset.wmStamp !== owner) face.dataset.wmStamp = owner;
  if (face.dataset.wmTone !== stamp.tone) face.dataset.wmTone = stamp.tone;
  setClass(face, STAMPED, true);
  setClass(face, HOVER, stamp.lightenOnHover === true);
  setClass(face, 'wm-stamp-toggle', stamp.revealable === true);
  setClass(face, 'wm-stamp-revealed', stamp.revealable === true && face.dataset.wmRevealed === '1');

  let overlay = overlayOf(face);
  if (!stamp.label) {
    overlay?.remove();
    return;
  }
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.className = `${ROOT_CLASS} wm-stamp`;
    overlay.append(document.createElement('span'));
    face.append(overlay);
  }
  const label = overlay.firstElementChild;
  if (label && label.textContent !== stamp.label) label.textContent = stamp.label;
}

function unstamp(face: HTMLElement): void {
  const tinted = face.classList.contains(STAMPED) && !face.classList.contains('wm-stamp-revealed');
  for (const name of [STAMPED, HOVER, 'wm-stamp-toggle', 'wm-stamp-revealed']) setClass(face, name, false);
  delete face.dataset.wmStamp;
  delete face.dataset.wmTone;
  delete face.dataset.wmRevealed;
  if (!tinted) {
    overlayOf(face)?.remove();
    return;
  }
  // Teinte et texte s'effacent en fondu, comme ils sont venus ; le texte quitte la page ensuite.
  stopFading(face);
  setClass(face, FADING, true);
  fadeTimers.set(
    face,
    window.setTimeout(() => {
      fadeTimers.delete(face);
      setClass(face, FADING, false);
      overlayOf(face)?.remove();
    }, FADE_MS),
  );
}

/** Retrait en cours interrompu : la face est tamponnée de nouveau. */
function stopFading(face: HTMLElement): void {
  const timer = fadeTimers.get(face);
  if (timer === undefined) return;
  window.clearTimeout(timer);
  fadeTimers.delete(face);
  setClass(face, FADING, false);
}

/** Face tamponnée, par qui que ce soit. */
export function isStamped(face: HTMLElement): boolean {
  return face.dataset.wmStamp !== undefined;
}

/** Faces tamponnées par `owner` (pour retirer celles qui ne doivent plus l'être). */
export function stampedFaces(owner: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-wm-stamp="${owner}"]`)];
}

/**
 * Les tampons de `owner` sous `root` exactement sur ces faces : posés ou mis à jour, retirés des autres faces qu'il
 * avait tamponnées. Idempotent.
 */
export function syncStamps(owner: string, wanted: Iterable<readonly [HTMLElement, Stamp]>, root: ParentNode = document): void {
  const faces = new Map(wanted);
  for (const face of stampedFaces(owner, root)) if (!faces.has(face)) stampFace(face, owner, undefined);
  for (const [face, stamp] of faces) stampFace(face, owner, stamp);
}

/** Retire tous les tampons de `owner` (démontage de sa fonctionnalité). */
export function unstampAll(owner: string): void {
  for (const face of stampedFaces(owner)) unstamp(face);
}
