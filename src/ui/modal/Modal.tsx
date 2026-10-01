import type { ComponentChildren } from 'preact';
import { useRef } from 'preact/hooks';
import { injectStyle } from '@/core/dom';
import { CloseButton } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { layers, tokens } from '@/ui/theme';
import { useModalBehavior } from './behavior';

const MODAL_CSS = `
.wm-modal-backdrop { position: fixed; inset: 0; z-index: ${layers.modal}; display: flex; align-items: center;
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
.wm-modal-body.wm-modal-padded { flex-direction: column; padding: 20px; overflow-y: auto; }
`;

export interface ModalProps {
  readonly title: string;
  /** Devant le titre (badge). */
  readonly titleBefore?: ComponentChildren;
  /** Ligne sous le titre. */
  readonly subtitle?: ComponentChildren;
  /** Boutons de l'en-tête, avant la croix. */
  readonly actions?: ComponentChildren;
  readonly onClose: () => void;
  /** Action en cours : ni Échap, ni le fond, ni la croix (désactivée) ne ferment la modale. */
  readonly locked?: boolean;
  /** Largeur maximale en pixels. */
  readonly width?: number;
  /** Hauteur fixe en pixels (réduite si l'écran est plus petit) ; sinon, selon le contenu. */
  readonly height?: number;
  /** Hauteur selon le contenu, au plus ces pixels (640 par défaut ; réduite si l'écran est plus petit). */
  readonly maxHeight?: number;
  /**
   * Corps avec la marge standard (20 px), contenu en colonne sur toute la largeur et qui défile s'il dépasse ;
   * sinon le contenu occupe le corps de bord à bord et gère lui-même ses marges.
   */
  readonly padded?: boolean;
  readonly children: ComponentChildren;
}

/** Modale aux couleurs du site : fond assombri, fermeture par Échap, clic sur le fond ou ✕. */
export function Modal({
  title,
  titleBefore,
  subtitle,
  actions,
  onClose,
  locked = false,
  width = 760,
  height,
  maxHeight,
  padded = false,
  children,
}: ModalProps) {
  injectStyle('ui-modal', MODAL_CSS);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  useModalBehavior({ overlay: backdrop, frame: panel, onClose, locked });

  return (
    <div ref={backdrop} class="wm-modal-backdrop">
      <div
        ref={panel}
        class="wm-modal"
        style={{
          maxWidth: `${width}px`,
          ...(maxHeight !== undefined && { maxHeight: `min(${maxHeight}px, calc(100vh - 32px))` }),
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
          <CloseButton disabled={locked} onClick={onClose} />
        </div>
        <div class={cx('wm-modal-body', padded && 'wm-modal-padded')}>{children}</div>
      </div>
    </div>
  );
}
