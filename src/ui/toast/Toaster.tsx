import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/theme';
import type { Toast, ToastPosition, ToastStore, ToastVariant } from './store';

export const TOASTER_CSS = `
.wm-toaster { position: fixed; right: 16px; z-index: 2147483000; display: flex; flex-direction: column; gap: 8px;
  width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.wm-toaster[data-position="bottom-right"] { bottom: 16px; flex-direction: column-reverse; }
.wm-toast { pointer-events: auto; display: flex; gap: 10px; align-items: flex-start; padding: 10px 12px;
  background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-left: 3px solid var(--wm-toast-color);
  border-radius: 12px; box-shadow: 0 8px 24px rgb(0 0 0 / 45%); animation: wm-fade-in 0.18s ease-out;
  font-size: 13px; }
.wm-toast[data-variant="error"] { --wm-toast-color: ${tokens.danger}; }
.wm-toast[data-variant="success"] { --wm-toast-color: ${tokens.success}; }
.wm-toast[data-variant="warning"] { --wm-toast-color: ${tokens.warning}; }
.wm-toast[data-variant="info"] { --wm-toast-color: ${tokens.info}; }
.wm-toast-icon { color: var(--wm-toast-color); flex: none; margin-top: 1px; }
.wm-toast-body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.wm-toast-title { font-family: ${tokens.heading}; font-weight: 700; margin-bottom: 2px; }
.wm-toast-action { display: inline-block; margin-top: 6px; padding: 0; border: 0; background: none; cursor: pointer;
  font: inherit; font-weight: 600; color: var(--wm-toast-color); text-decoration: underline; text-underline-offset: 3px; }
.wm-toast-action:hover { filter: brightness(1.2); }
.wm-toast-close { flex: none; background: none; border: 0; padding: 2px; margin: -2px -4px 0 0; cursor: pointer;
  font: inherit; color: ${tokens.foreground}; opacity: 0.5; border-radius: 6px; }
.wm-toast-close:hover { opacity: 1; background: ${tokens.surfaceLight}; }
`;

const ICON: Record<ToastVariant, 'error' | 'success' | 'warning' | 'info'> = {
  error: 'error',
  success: 'success',
  warning: 'warning',
  info: 'info',
};

export interface ToasterProps {
  readonly store: ToastStore;
  /** Distance du haut de l'écran pour la pile du haut (sous le solde du site). */
  readonly topOffset: () => number;
}

/** Les deux piles de toasts, abonnées à la file. */
export function Toaster({ store, topOffset }: ToasterProps) {
  const [toasts, setToasts] = useState(store.list());
  useEffect(() => store.subscribe(() => setToasts(store.list())), [store]);

  const stack = (position: ToastPosition) => {
    const items = toasts.filter((toast) => toast.position === position);
    if (items.length === 0) return null;
    const style = position === 'top-right' ? { top: `${topOffset()}px` } : undefined;
    return (
      <div class="wm-toaster" data-position={position} style={style}>
        {items.map((toast) => (
          <ToastView key={toast.id} toast={toast} onClose={() => store.dismiss(toast.id)} />
        ))}
      </div>
    );
  };

  return (
    <>
      {stack('top-right')}
      {stack('bottom-right')}
    </>
  );
}

function ToastView({ toast, onClose }: { toast: Toast; onClose: () => void }) {
  return (
    <div class="wm-toast" data-variant={toast.variant} role={toast.variant === 'error' ? 'alert' : 'status'}>
      <Icon name={ICON[toast.variant]} size={18} class="wm-toast-icon" />
      <div class="wm-toast-body">
        {toast.title && <div class="wm-toast-title">{toast.title}</div>}
        <div>{toast.message}</div>
        {toast.action && (
          <button
            type="button"
            class="wm-toast-action"
            onClick={() => {
              onClose();
              toast.action?.onClick();
            }}
          >
            {toast.action.label}
          </button>
        )}
      </div>
      <button type="button" class="wm-toast-close" aria-label="Fermer" onClick={onClose}>
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
