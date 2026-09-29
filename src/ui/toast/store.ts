export type ToastVariant = 'info' | 'success' | 'warning' | 'error';

/** Erreurs et avertissements en haut à droite, sous le solde ; notifications en bas à droite. */
export type ToastPosition = 'top-right' | 'bottom-right';

/** Lien d'action dans le toast (« Voir l'enchère »…) : le suivre ferme le toast. */
export interface ToastAction {
  readonly label: string;
  readonly onClick: () => void;
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
  list(): readonly Toast[];
  /** Prévenu à chaque ajout ou retrait ; renvoie la fonction de désinscription. */
  subscribe(listener: () => void): () => void;
}

interface Timers {
  setTimeout(callback: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

/** File des toasts, sans DOM : l'affichage s'y abonne (`Toaster`). */
export function createToastStore(timers: Timers = globalThis): ToastStore {
  let toasts: Toast[] = [];
  let nextId = 1;
  const handles = new Map<number, unknown>();
  const listeners = new Set<() => void>();

  const notify = () => listeners.forEach((listener) => listener());

  function dismiss(id: number): void {
    const handle = handles.get(id);
    if (handle !== undefined) timers.clearTimeout(handle);
    handles.delete(id);
    const before = toasts.length;
    toasts = toasts.filter((toast) => toast.id !== id);
    if (toasts.length !== before) notify();
  }

  return {
    show(options) {
      const variant = options.variant ?? 'info';
      const toast: Toast = {
        id: nextId++,
        message: options.message,
        ...(options.title !== undefined && { title: options.title }),
        variant,
        position: options.position ?? DEFAULT_POSITION[variant],
        ...(options.action && { action: options.action }),
      };
      const samePosition = toasts.filter((t) => t.position === toast.position);
      const overflow = samePosition.length - MAX_PER_POSITION + 1;
      for (const old of samePosition.slice(0, Math.max(0, overflow))) dismiss(old.id);

      toasts = [...toasts, toast];
      const duration = options.sticky ? 0 : (options.durationMs ?? DEFAULT_DURATION[variant]);
      if (duration > 0) handles.set(toast.id, timers.setTimeout(() => dismiss(toast.id), duration));
      notify();
      return toast.id;
    },
    dismiss,
    list: () => toasts,
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}
