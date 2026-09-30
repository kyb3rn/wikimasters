import { injectStyle, ROOT_CLASS, setClass } from '@/core/dom';
import { tokens } from './theme';

/**
 * Tampon sur une face de carte du site : carte teintée et texte en diagonale (« Défaussée »,
 * « En vente »…). Dans une modale (`revealable`), un clic sur la carte retire la teinte et le texte
 * en fondu pour la revoir propre, un autre clic les remet ; cet état vit sur la face elle-même et
 * disparaît avec elle (modale refermée).
 */
export interface Stamp {
  readonly label: string;
  /** `danger` : grisée, texte rouge ; `success` : verdie, texte vert. */
  readonly tone: 'danger' | 'success';
  readonly revealable?: boolean;
}

const STAMPED = 'wm-stamped';

const CSS = `
.${STAMPED}:not(.wm-stamp-revealed) { box-shadow: none !important; }
.${STAMPED} > :not(.wm-stamp) { transition: filter 0.35s, opacity 0.35s; }
.${STAMPED}[data-wm-tone="danger"] { --wm-stamp-color: ${tokens.danger}; }
.${STAMPED}[data-wm-tone="success"] { --wm-stamp-color: ${tokens.success}; }
.${STAMPED}[data-wm-tone="danger"]:not(.wm-stamp-revealed) > :not(.wm-stamp) { filter: grayscale(1); opacity: 0.45; }
.${STAMPED}[data-wm-tone="success"]:not(.wm-stamp-revealed) > :not(.wm-stamp) {
  filter: grayscale(1) sepia(0.6) hue-rotate(75deg) saturate(1.4) brightness(0.8); opacity: 0.55; }
.wm-stamp { position: absolute; inset: 0; z-index: 45; display: flex; align-items: center; justify-content: center;
  pointer-events: none; transition: opacity 0.35s; }
.wm-stamp > span { transform: rotate(-30deg); padding: 4px 14px; border: 2px solid var(--wm-stamp-color);
  border-radius: 8px; color: var(--wm-stamp-color); background: rgb(13 17 23 / 78%); font-family: ${tokens.heading};
  font-size: 18px; font-weight: 800; letter-spacing: 0.12em; text-transform: uppercase; white-space: nowrap; }
.wm-stamp-revealed > .wm-stamp { opacity: 0; }
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

/**
 * Pose, met à jour ou retire (`stamp` absent) le tampon de `owner` sur une face. Une face ne porte qu'un
 * tampon : celui d'un autre propriétaire est laissé tel quel. Idempotent : n'écrit que ce qui change.
 */
export function stampFace(face: HTMLElement, owner: string, stamp: Stamp | undefined): void {
  const current = face.dataset.wmStamp;
  if (current && current !== owner) return;
  if (!stamp) {
    if (current === owner) unstamp(face);
    return;
  }
  install();
  if (current !== owner) face.dataset.wmStamp = owner;
  if (face.dataset.wmTone !== stamp.tone) face.dataset.wmTone = stamp.tone;
  setClass(face, STAMPED, true);
  setClass(face, 'wm-stamp-toggle', stamp.revealable === true);
  setClass(face, 'wm-stamp-revealed', stamp.revealable === true && face.dataset.wmRevealed === '1');

  let overlay = face.querySelector<HTMLElement>(':scope > .wm-stamp');
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
  for (const name of [STAMPED, 'wm-stamp-toggle', 'wm-stamp-revealed']) setClass(face, name, false);
  delete face.dataset.wmStamp;
  delete face.dataset.wmTone;
  delete face.dataset.wmRevealed;
  face.querySelectorAll(':scope > .wm-stamp').forEach((overlay) => overlay.remove());
}

/** Face tamponnée, par qui que ce soit. */
export function isStamped(face: HTMLElement): boolean {
  return face.dataset.wmStamp !== undefined;
}

/** Faces tamponnées par `owner` (pour retirer celles qui ne doivent plus l'être). */
export function stampedFaces(owner: string, root: ParentNode = document): HTMLElement[] {
  return [...root.querySelectorAll<HTMLElement>(`[data-wm-stamp="${owner}"]`)];
}

/** Retire tous les tampons de `owner` (démontage de sa fonctionnalité). */
export function unstampAll(owner: string): void {
  for (const face of stampedFaces(owner)) unstamp(face);
}
