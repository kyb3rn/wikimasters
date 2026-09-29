import { injectStyle } from '@/core/dom';
import { isRecord } from '@/core/guards';

export type LockableControl = HTMLButtonElement | HTMLInputElement;

const LOCKED = 'wm-site-disabled';

/* Pas de pointer-events: none, sinon le curseur « interdit » ne s'afficherait pas : les clics sont
   bloqués par l'attribut disabled et par un écouteur en capture. */
const CSS = `.${LOCKED} { opacity: 0.4 !important; cursor: not-allowed !important; }`;

/** Événements arrêtés sur un contrôle verrouillé, même si React le réactivait un instant. */
const GUARDED_EVENTS = ['click', 'pointerdown', 'pointerup', 'mousedown', 'mouseup', 'touchstart', 'touchend', 'keydown', 'beforeinput'];

let guarded = false;

function ensureGuard(): void {
  if (guarded) return;
  guarded = true;
  injectStyle('ui-lock', CSS);
  const block = (event: Event) => {
    if (!(event.target instanceof Element) || !event.target.closest(`.${LOCKED}`)) return;
    event.preventDefault();
    event.stopImmediatePropagation();
  };
  for (const type of GUARDED_EVENTS) window.addEventListener(type, block, { capture: true, passive: false });
}

/** Verrous posés sur un contrôle : propriétaire (fonctionnalité) → raison affichée. */
function readLocks(control: LockableControl): Record<string, string> {
  try {
    const parsed: unknown = JSON.parse(control.dataset.wmLocks ?? '{}');
    if (!isRecord(parsed)) return {};
    return Object.fromEntries(Object.entries(parsed).filter((entry): entry is [string, string] => typeof entry[1] === 'string'));
  } catch {
    return {};
  }
}

export interface LockOptions {
  /** Qui verrouille (id de la fonctionnalité) : chacun ne lève que son propre verrou. */
  readonly owner: string;
  readonly locked: boolean;
  /** Info-bulle : pourquoi le contrôle est désactivé. */
  readonly reason?: string;
}

/**
 * Désactive un contrôle du site (bouton, champ) avec une info-bulle qui dit pourquoi, ou lève ce
 * verrou. Plusieurs fonctionnalités peuvent verrouiller le même contrôle : il reste désactivé tant
 * qu'il en reste une. Rétabli tel qu'il était (désactivé ou non, info-bulle), sans jamais réactiver ce
 * que le site avait lui-même désactivé, ni laisser désactivé ce qu'il a réactivé entre-temps.
 * Idempotent : n'écrit dans le DOM que ce qui change.
 */
export function lockControl(control: LockableControl, { owner, locked, reason = '' }: LockOptions): void {
  const locks = readLocks(control);
  if (locked) locks[owner] = reason;
  else delete locks[owner];

  const reasons = Object.values(locks);
  const isLocked = control.classList.contains(LOCKED);
  if (reasons.length > 0) {
    ensureGuard();
    if (!isLocked) {
      control.dataset.wmWasDisabled = String(control.disabled);
      control.dataset.wmTitle = control.title;
      control.classList.add(LOCKED);
    } else if (!control.disabled && control.dataset.wmWasDisabled !== 'false') {
      // Réactivé par le site pendant le verrou : il le veut actif une fois le verrou levé.
      control.dataset.wmWasDisabled = 'false';
    }
    const serialized = JSON.stringify(locks);
    if (control.dataset.wmLocks !== serialized) control.dataset.wmLocks = serialized;
    const title = reasons[0] ?? '';
    if (control.title !== title) control.title = title;
    if (!control.disabled) control.disabled = true;
  } else if (isLocked) {
    control.classList.remove(LOCKED);
    control.disabled = control.dataset.wmWasDisabled === 'true';
    control.title = control.dataset.wmTitle ?? '';
    delete control.dataset.wmWasDisabled;
    delete control.dataset.wmTitle;
    delete control.dataset.wmLocks;
  }
}

/** Lève tous les verrous d'un propriétaire (démontage de sa fonctionnalité). */
export function unlockAll(owner: string): void {
  for (const control of document.querySelectorAll<LockableControl>(`.${LOCKED}`)) {
    lockControl(control, { owner, locked: false });
  }
}
