import type { ComponentChildren } from 'preact';
import { useEffect, useRef } from 'preact/hooks';
import { injectStyle } from '@/core/dom';
import { CloseButton } from '@/ui/controls';
import { tokens } from '@/ui/theme';
import { useBackdropGuard } from './backdrop';
import { useSmoothExit } from './exit';

const MODAL_CSS = `
.wm-modal-backdrop { position: fixed; inset: 0; z-index: 2147482000; display: flex; align-items: center;
  justify-content: center; padding: 16px; background: ${tokens.backdrop}; backdrop-filter: ${tokens.backdropBlur}; }
.wm-modal { display: flex; flex-direction: column; width: 100%; max-height: min(640px, calc(100vh - 32px));
  background: ${tokens.surface}; border: 1px solid ${tokens.border}; border-radius: 16px;
  box-shadow: 0 16px 48px rgb(0 0 0 / 55%); overflow: hidden; animation: wm-fade-in 0.18s ease-out; }
.wm-modal-header { display: flex; align-items: center; gap: 12px; padding: 14px 16px 14px 20px;
  border-bottom: 1px solid ${tokens.border}; }
.wm-modal-heading { flex: 1; min-width: 0; }
.wm-modal-title { display: flex; align-items: center; gap: 8px; margin: 0; font-family: ${tokens.heading}; font-size: 18px; font-weight: 700; }
.wm-modal-subtitle { margin-top: 2px; font-size: 12px; opacity: 0.55; }
.wm-modal-actions { display: flex; flex: none; align-items: center; gap: 8px; }
.wm-modal-body { flex: 1; min-height: 0; display: flex; }
`;

/** Modales du script actuellement ouvertes. */
let openCount = 0;

/** Une de nos modales est-elle ouverte ? (les raccourcis clavier des fonctionnalités s'effacent alors) */
export function isModalOpen(): boolean {
  return openCount > 0;
}

/** Compte le composant parmi nos modales ouvertes tant qu'il est affiché. */
export function useOpenModal(): void {
  useEffect(() => {
    openCount++;
    return () => {
      openCount--;
    };
  }, []);
}

export interface ModalProps {
  readonly title: string;
  /** Devant le titre (badge). */
  readonly titleBefore?: ComponentChildren;
  /** Ligne sous le titre. */
  readonly subtitle?: ComponentChildren;
  /** Boutons de l'en-tête, avant la croix. */
  readonly actions?: ComponentChildren;
  readonly onClose: () => void;
  /** Largeur maximale en pixels. */
  readonly width?: number;
  /** Hauteur fixe en pixels (réduite si l'écran est plus petit) ; sinon, selon le contenu. */
  readonly height?: number;
  readonly children: ComponentChildren;
}

/** Modale aux couleurs du site : fond assombri, fermeture par Échap, clic sur le fond ou ✕. */
export function Modal({ title, titleBefore, subtitle, actions, onClose, width = 760, height, children }: ModalProps) {
  injectStyle('ui-modal', MODAL_CSS);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useOpenModal();
  useSmoothExit(backdrop, panel);
  useBackdropGuard(backdrop);

  useEffect(() => {
    // Un champ du contenu a pu prendre le focus (ses effets passent avant ceux de la modale) : le lui laisser.
    if (!panel.current?.contains(document.activeElement)) panel.current?.focus();
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.stopPropagation();
      onClose();
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <div
      ref={backdrop}
      class="wm-modal-backdrop"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div
        ref={panel}
        class="wm-modal"
        style={{
          maxWidth: `${width}px`,
          ...(height !== undefined && { height: `${height}px`, maxHeight: 'calc(100vh - 32px)' }),
        }}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        tabIndex={-1}
      >
        <div class="wm-modal-header">
          <div class="wm-modal-heading">
            <h2 class="wm-modal-title">
              {titleBefore}
              {title}
            </h2>
            {subtitle && <div class="wm-modal-subtitle">{subtitle}</div>}
          </div>
          {actions && <div class="wm-modal-actions">{actions}</div>}
          <CloseButton onClick={onClose} />
        </div>
        <div class="wm-modal-body">{children}</div>
      </div>
    </div>
  );
}
