import { injectStyle, setClass } from '@/core/dom';
import { isRecord, parseJson } from '@/core/guards';
import { DISABLED_OPACITY, ensureBaseStyle } from './theme';

export type LockableControl = HTMLButtonElement | HTMLInputElement;

const LOCKED = 'wm-site-disabled';
const BUSY = 'wm-site-busy';
/**
 * Contrôle verrouillé, reconnu à ses verrous (`data-wm-locks`) et pas à sa classe : React réécrit l'attribut `class`
 * quand il change la sienne, la classe est alors remise au prochain appel.
 */
const LOCKED_CONTROL = '[data-wm-locks]';

/*
 * Pas de pointer-events: none, sinon le curseur « interdit » ne s'afficherait pas : les clics sont
 * bloqués par l'attribut disabled et par un écouteur en capture.
 * En cours : l'icône lucide du contrôle devient la roue, à sa taille (ses tracés cachés, un cercle ouvert dessiné en
 * bordure de l'icône elle-même, qui tourne) ; sans icône, la roue passe devant le texte.
 */
const CSS = `
.${LOCKED} { opacity: ${DISABLED_OPACITY} !important; cursor: not-allowed !important; }
.${BUSY} svg.lucide > * { display: none; }
.${BUSY} svg.lucide { box-sizing: border-box; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: wm-spin 0.8s linear infinite; }
.${BUSY}:not(:has(svg.lucide))::before { content: ''; display: inline-block; flex: none; vertical-align: middle;
  width: 1em; height: 1em; margin-right: 0.5em; border: 2px solid currentColor; border-right-color: transparent;
  border-radius: 50%; animation: wm-spin 0.8s linear infinite; }
.${BUSY}:is(.flex, .inline-flex):not(:has(svg.lucide))::before { margin-right: 0; }
`;

/** Événements arrêtés sur un contrôle verrouillé, même si React le réactivait un instant. */
const GUARDED_EVENTS = ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'beforeinput'];

let guarded = false;

function ensureGuard(): void {
  if (guarded) return;
  guarded = true;
  // Animation `wm-spin` de la roue.
  ensureBaseStyle();
  injectStyle('ui-lock', CSS);
  const block = (event: Event) => {
    if (!(event.target instanceof Element) || !event.target.closest(LOCKED_CONTROL)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of GUARDED_EVENTS) window.addEventListener(type, block, { capture: true, passive: false });
}

/** Verrous posés sur un contrôle : propriétaire (fonctionnalité) → raison affichée. */
function readLocks(control: LockableControl): Record<string, string> {
  const parsed = parseJson(control.dataset.wmLocks ?? '{}');
  if (!isRecord(parsed)) return {};
  return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
}

/** Propriétaires dont l'action est en cours. */
const readBusy = (control: LockableControl): Set<string> => new Set((control.dataset.wmBusy ?? '').split(' ').filter(Boolean));

export interface LockOptions {
  /** Qui verrouille (id de la fonctionnalité) : chacun ne lève que son propre verrou. */
  readonly owner: string;
  readonly locked: boolean;
  /** Info-bulle : pourquoi le contrôle est désactivé. */
  readonly reason?: string;
  /**
   * Verrouillé parce qu'une action de `owner` est en cours (avec `locked`) : la roue à la place de l'icône lucide du
   * contrôle, ou devant son texte, et `aria-busy`. Elle reste tant qu'un propriétaire est en cours.
   */
  readonly busy?: boolean;
}

/**
 * Désactive un contrôle du site (bouton, champ) avec une info-bulle qui dit pourquoi, ou lève ce
 * verrou. Plusieurs fonctionnalités peuvent verrouiller le même contrôle : il reste désactivé tant
 * qu'il en reste une. Rétabli tel qu'il était (désactivé ou non, info-bulle), sans jamais réactiver ce
 * que le site avait lui-même désactivé, ni laisser désactivé ce qu'il a réactivé entre-temps.
 * Idempotent : n'écrit dans le DOM que ce qui change.
 */
export function lockControl(control: LockableControl, { owner, locked, reason = '', busy = false }: LockOptions): void {
  const locks = readLocks(control);
  const busyOwners = readBusy(control);
  if (locked) locks[owner] = reason;
  else delete locks[owner];
  if (locked && busy) busyOwners.add(owner);
  else busyOwners.delete(owner);

  const reasons = Object.values(locks);
  const isLocked = control.dataset.wmLocks !== undefined;
  if (reasons.length > 0) {
    ensureGuard();
    if (!isLocked) {
      control.dataset.wmWasDisabled = String(control.disabled);
      control.dataset.wmTitle = control.title;
    } else if (!control.disabled && control.dataset.wmWasDisabled !== 'false') {
      // Réactivé par le site pendant le verrou : il le veut actif une fois le verrou levé.
      control.dataset.wmWasDisabled = 'false';
    }
    setClass(control, LOCKED, true);
    const serialized = JSON.stringify(locks);
    if (control.dataset.wmLocks !== serialized) control.dataset.wmLocks = serialized;
    const busyList = [...busyOwners].join(' ');
    if (busyList) {
      if (control.dataset.wmBusy !== busyList) control.dataset.wmBusy = busyList;
      if (control.getAttribute('aria-busy') !== 'true') control.setAttribute('aria-busy', 'true');
    } else if (control.dataset.wmBusy !== undefined) {
      delete control.dataset.wmBusy;
      control.removeAttribute('aria-busy');
    }
    setClass(control, BUSY, busyList !== '');
    const title = reasons[0] ?? '';
    if (control.title !== title) control.title = title;
    if (!control.disabled) control.disabled = true;
  } else if (isLocked) {
    setClass(control, LOCKED, false);
    setClass(control, BUSY, false);
    if (control.dataset.wmBusy !== undefined) control.removeAttribute('aria-busy');
    control.disabled = control.dataset.wmWasDisabled === 'true';
    control.title = control.dataset.wmTitle ?? '';
    delete control.dataset.wmWasDisabled;
    delete control.dataset.wmTitle;
    delete control.dataset.wmLocks;
    delete control.dataset.wmBusy;
  }
}

/** Raison du verrou d'un contrôle (la première), s'il est verrouillé : pour qu'un contrôle à nous qui le remplace le suive. */
export function lockReason(control: LockableControl): string | undefined {
  if (control.dataset.wmLocks === undefined) return undefined;
  return Object.values(readLocks(control))[0] ?? '';
}

/** Lève tous les verrous d'un propriétaire (démontage de sa fonctionnalité). */
export function unlockAll(owner: string): void {
  for (const control of document.querySelectorAll<LockableControl>(LOCKED_CONTROL)) {
    lockControl(control, { owner, locked: false });
  }
}
