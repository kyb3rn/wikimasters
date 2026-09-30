import { useEffect, useState } from 'preact/hooks';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/theme';
import type { Toast, ToastPosition, ToastStore, ToastVariant } from './store';

// Le site n'a pas de toasts : ceux-ci reprennent ses encarts teintés (celui du solde WB : bordure et
// dégradé de la couleur, halo, icône dans une tuile) et son petit bouton teinté, avec sa palette
// Tailwind v4 (teinte 400 pour le texte, 500 pour les fonds et bordures).
const PALETTE: Record<ToastVariant, { text: string; tint: string }> = {
  error: { text: 'oklch(70.4% 0.191 22.216)', tint: 'oklch(63.7% 0.237 25.331)' },
  success: { text: 'oklch(76.5% 0.177 163.223)', tint: 'oklch(69.6% 0.17 162.48)' },
  warning: { text: 'oklch(82.8% 0.189 84.429)', tint: 'oklch(76.9% 0.188 70.08)' },
  info: { text: 'oklch(74.6% 0.16 232.661)', tint: 'oklch(68.5% 0.169 237.323)' },
};

const tint = (percent: number) => `color-mix(in oklab, var(--wm-toast-tint) ${percent}%, transparent)`;
const dim = (percent: number) => `color-mix(in oklab, ${tokens.foreground} ${percent}%, transparent)`;

export const TOASTER_CSS = `
.wm-toaster { position: fixed; right: 16px; z-index: 2147483000; display: flex; flex-direction: column; gap: 10px;
  width: min(360px, calc(100vw - 32px)); pointer-events: none; }
.wm-toaster[data-position="bottom-right"] { bottom: 16px; flex-direction: column-reverse; }
.wm-toast { pointer-events: auto; display: flex; gap: 12px; align-items: center; padding: 12px 10px 12px 12px;
  background: linear-gradient(135deg, color-mix(in oklab, var(--wm-toast-tint) 10%, ${tokens.surface}), ${tokens.surface} 60%);
  border: 1px solid ${tint(25)}; border-radius: 16px;
  box-shadow: 0 12px 32px -8px rgb(0 0 0 / 60%), 0 0 30px -12px ${tint(45)};
  animation: wm-fade-in 0.18s ease-out; font-size: 13px; }
${(Object.keys(PALETTE) as ToastVariant[])
  .map((variant) => `.wm-toast[data-variant="${variant}"] { --wm-toast-color: ${PALETTE[variant].text}; --wm-toast-tint: ${PALETTE[variant].tint}; }`)
  .join('\n')}
.wm-toast-icon { flex: none; display: flex; align-items: center; justify-content: center; width: 36px; height: 36px;
  border-radius: 10px; border: 1px solid ${tint(20)}; background: ${tint(15)}; color: var(--wm-toast-color); }
.wm-toast-body { flex: 1; min-width: 0; overflow-wrap: anywhere; }
.wm-toast-title { font-size: 14px; font-weight: 600; line-height: 1.3; }
.wm-toast-message { color: ${dim(90)}; }
.wm-toast-title + .wm-toast-message { margin-top: 2px; color: ${dim(60)}; }
.wm-toast-action { display: inline-flex; margin-top: 8px; padding: 6px 12px; border-radius: 8px; border: 1px solid ${tint(25)};
  background: ${tint(10)}; color: var(--wm-toast-color); font: inherit; font-size: 12px; font-weight: 600; cursor: pointer;
  transition: background-color 0.15s; }
.wm-toast-action:hover { background: ${tint(20)}; }
.wm-toast-close { flex: none; display: flex; align-items: center; justify-content: center; width: 28px; height: 28px;
  padding: 0; border: 0; border-radius: 9999px; background: none; cursor: pointer; color: ${dim(45)};
  transition: color 0.15s, background-color 0.15s; }
.wm-toast-close:hover { color: ${tokens.foreground}; background: ${tokens.surfaceLight}; }
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
      <span class="wm-toast-icon" aria-hidden="true">
        <Icon name={ICON[toast.variant]} size={18} />
      </span>
      <div class="wm-toast-body">
        {toast.title && <div class="wm-toast-title">{toast.title}</div>}
        <div class="wm-toast-message">{toast.message}</div>
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
