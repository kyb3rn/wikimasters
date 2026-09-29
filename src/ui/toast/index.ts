import { h, render } from 'preact';
import { injectStyle, ROOT_CLASS, whenBody } from '@/core/dom';
import { ensureBaseStyle } from '@/ui/theme';
import { createToastStore, type ToastOptions } from './store';
import { Toaster, TOASTER_CSS } from './Toaster';

export {
  createToastStore,
  type Toast,
  type ToastAction,
  type ToastOptions,
  type ToastPosition,
  type ToastStore,
  type ToastVariant,
} from './store';

const store = createToastStore();
let topOffset = () => 16;
let mounted = false;

/** Règle la distance du haut de la pile des erreurs (main.ts : sous le solde du site). */
export function configureToasts(options: { topOffset: () => number }): void {
  topOffset = options.topOffset;
}

function ensureMounted(): void {
  if (mounted) return;
  mounted = true;
  void whenBody().then((body) => {
    ensureBaseStyle();
    injectStyle('ui-toast', TOASTER_CSS);
    const container = document.createElement('div');
    container.className = ROOT_CLASS;
    body.append(container);
    render(h(Toaster, { store, topOffset: () => topOffset() }), container);
  });
}

type Shortcut = (message: string, options?: Omit<ToastOptions, 'message' | 'variant'>) => number;

const shortcut =
  (variant: NonNullable<ToastOptions['variant']>): Shortcut =>
  (message, options) =>
    toast.show({ ...options, message, variant });

/**
 * Toasts du script, partout sur le site. Erreurs et avertissements en haut à droite (sous le solde),
 * 8 s ; succès et informations en bas à droite, 6 s ; `position`, `durationMs` ou `sticky`
 * (jusqu'à fermeture) pour changer ; `action` pour un lien (« Voir l'enchère »).
 */
export const toast = {
  show(options: ToastOptions): number {
    ensureMounted();
    return store.show(options);
  },
  error: shortcut('error'),
  warning: shortcut('warning'),
  success: shortcut('success'),
  info: shortcut('info'),
  dismiss: (id: number) => store.dismiss(id),
};
