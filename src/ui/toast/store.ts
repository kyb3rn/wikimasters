export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

/** Erreurs et avertissements en haut à droite, sous le solde ; notifications en bas à droite. */
export type ToastPosition = 'top-right' | 'bottom-right';

/** Lien d'action dans le toast (« Voir l'enchère »…) : le suivre ferme le toast. */
export interface ToastAction {
  readonly label: string;
  /** Clic simple. */
  readonly onClick: () => void;
  /** Page du lien : un vrai lien, que Ctrl, Maj ou le clic du milieu ouvrent dans un autre onglet par le navigateur. */
  readonly href?: string;
  /** Ouvert ainsi dans un autre onglet (`href`). */
  readonly onOpenElsewhere?: () => void;
}

export interface ToastOptions {
  readonly message: string;
  readonly title?: string;
  readonly variant?: ToastVariant;
  readonly position?: ToastPosition;
  /** Reste affiché jusqu'à ce qu'on le ferme (pas de durée). */
  readonly sticky?: boolean;
  /** Durée d'affichage ; par défaut 8 s pour une erreur ou un avertissement, 6 s sinon. */
  readonly durationMs?: number;
  readonly action?: ToastAction;
}

export interface Toast {
  readonly id: number;
  readonly message: string;
  readonly title?: string;
  readonly variant: ToastVariant;
  readonly position: ToastPosition;
  readonly action?: ToastAction;
  /** Durée d'affichage, absente pour un toast « sticky » (sans barre de progression). */
  readonly durationMs?: number;
}

const DEFAULT_DURATION: Record<ToastVariant, number> = { error: 8000, warning: 8000, success: 6000, info: 6000 };
const DEFAULT_POSITION: Record<ToastVariant, ToastPosition> = {
  error: 'top-right',
  warning: 'top-right',
  success: 'bottom-right',
  info: 'bottom-right',
};
/** Au-delà, le plus ancien toast d'une même position disparaît. */
const MAX_PER_POSITION = 4;

export interface ToastStore {
  show(options: ToastOptions): number;
  dismiss(id: number): void;
  /** Arrête le compte à rebours d'un toast (curseur dessus) ; `resume` le reprend là où il en était. */
  pause(id: number): void;
  resume(id: number): void;
  list(): readonly Toast[];
  /** Prévenu à chaque ajout ou retrait ; renvoie la fonction de désinscription. */
  subscribe(listener: () => void): () => void;
}

interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
  now(): number;
}

const BROWSER_TIMERS: Timers = {
  setTimeout: (callback, ms) => setTimeout(callback, ms),
  clearTimeout: (handle) => clearTimeout(handle as ReturnType<typeof setTimeout>),
  now: () => performance.now(),
};

/** Temps restant d'un toast minuté ; `handle` absent tant qu'il est en pause. */
interface Countdown {
  remaining: number;
  startedAt: number;
  handle?: unknown;
}

/** File des toasts, sans DOM : l'affichage s'y abonne (`Toaster`). */
export function createToastStore(timers: Timers = BROWSER_TIMERS): ToastStore {
  let toasts: Toast[] = [];
  let nextId = 1;
  const countdowns = new Map<number, Countdown>();
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  function run(id: number, countdown: Countdown): void {
    countdown.startedAt = timers.now();
    countdown.handle = timers.setTimeout(() => dismiss(id), countdown.remaining);
  }

  function dismiss(id: number): void {
    const handle = countdowns.get(id)?.handle;
    if (handle !== undefined) timers.clearTimeout(handle);
    countdowns.delete(id);
    const before = toasts.length;
    toasts = toasts.filter((toast) => toast.id !== id);
    if (toasts.length !== before) notify();
  }

  return {
    show(options) {
      const variant = options.variant ?? 'info';
      const duration = options.sticky ? 0 : (options.durationMs ?? DEFAULT_DURATION[variant]);
      const toast: Toast = {
        id: nextId++,
        message: options.message,
        ...(options.title !== undefined && { title: options.title }),
        variant,
        position: options.position ?? DEFAULT_POSITION[variant],
        ...(options.action && { action: options.action }),
        ...(duration > 0 && { durationMs: duration }),
      };
      const samePosition = toasts.filter((t) => t.position === toast.position);
      const overflow = samePosition.length - MAX_PER_POSITION + 1;
      for (const old of samePosition.slice(0, Math.max(0, overflow))) dismiss(old.id);

      toasts = [...toasts, toast];
      if (duration > 0) {
        const countdown: Countdown = { remaining: duration, startedAt: 0 };
        countdowns.set(toast.id, countdown);
        run(toast.id, countdown);
      }
      notify();
      return toast.id;
    },
    dismiss,
    pause(id) {
      const countdown = countdowns.get(id);
      if (countdown?.handle === undefined) return;
      timers.clearTimeout(countdown.handle);
      delete countdown.handle;
      countdown.remaining = Math.max(0, countdown.remaining - (timers.now() - countdown.startedAt));
    },
    resume(id) {
      const countdown = countdowns.get(id);
      if (countdown && countdown.handle === undefined) run(id, countdown);
    },
    list: () => toasts,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
