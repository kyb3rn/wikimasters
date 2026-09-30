import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useRef, useState } from 'preact/hooks';
import { childController } from '@/core/async';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { mountUi } from '@/ui/mount';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { useBackdropGuard } from './backdrop';
import { useSmoothExit } from './exit';
import { useOpenModal } from './Modal';

export interface ConfirmOptions {
  readonly title: string;
  readonly message?: ComponentChildren;
  /** Bouton de confirmation, rouge : l'action est destructrice. */
  readonly confirmLabel: string;
  /**
   * Lancée par la confirmation : roue sur le bouton et tout désactivé jusqu'à sa fin (réussite ou échec, à elle
   * de le signaler), puis la fenêtre se ferme.
   */
  readonly onConfirm: () => Promise<unknown> | void;
  /** Ferme la fenêtre (démontage de la fonctionnalité qui l'a ouverte). */
  readonly signal: AbortSignal;
}

interface DialogProps extends Omit<ConfirmOptions, 'signal'> {
  readonly onClose: () => void;
}

function ConfirmDialog({ title, message, confirmLabel, onConfirm, onClose }: DialogProps) {
  const [busy, setBusy] = useState(false);
  const overlay = useRef<HTMLDivElement>(null);
  const frame = useRef<HTMLDivElement>(null);
  useOpenModal();
  useSmoothExit(overlay, frame);
  useBackdropGuard(overlay);

  useEffect(() => frame.current?.focus(), []);

  // Dès l'affichage (un effet ordinaire attend l'image suivante : un Échap tapé aussitôt serait perdu).
  useLayoutEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      if (!busy) onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [busy, onClose]);

  const confirm = () => {
    if (busy) return;
    setBusy(true);
    void Promise.resolve()
      .then(onConfirm)
      .catch(() => undefined)
      .finally(onClose);
  };

  return (
    <div
      ref={overlay}
      class={siteClass.confirmOverlay}
      style={{ zIndex: 2147482000 }}
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) onClose();
      }}
    >
      <div ref={frame} class={siteClass.confirmFrame} role="alertdialog" aria-modal="true" aria-label={title} tabIndex={-1}>
        <h3 class={siteClass.confirmTitle} style={{ fontFamily: tokens.heading }}>
          {title}
        </h3>
        {message && <p class={siteClass.confirmText}>{message}</p>}
        <div class={siteClass.confirmActions}>
          <button type="button" class={buttonClass('window')} disabled={busy} onClick={onClose}>
            Annuler
          </button>
          <button
            type="button"
            class={buttonClass('window', { tone: 'danger', fill: 'solid' })}
            disabled={busy}
            aria-busy={busy}
            onClick={confirm}
          >
            {busy && <Icon name="spinner" size={16} class="wm-spin" />}
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Confirmation simple, celle du site (« Défausser cette carte ? ») : titre, texte, Annuler · action en rouge.
 * Par-dessus tout ; Échap, clic sur le fond ou « Annuler » la ferment, sauf pendant l'action.
 */
export function openConfirm({ signal, ...options }: ConfirmOptions): void {
  const controller = childController(signal);
  mountUi(<ConfirmDialog {...options} onClose={() => controller.abort()} />, { signal: controller.signal });
}
