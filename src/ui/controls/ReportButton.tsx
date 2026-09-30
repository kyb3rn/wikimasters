import { injectStyle } from '@/core/dom';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

// Posé sur l'image : il lui faut un fond (rond gris plein), rouge une fois l'image signalée.
const CSS = `
.wm-report { position: absolute; right: 8px; bottom: 8px; z-index: 35; }
`;

export interface ReportButtonProps {
  /** Texte du bouton d'origine du site (« Signaler l'image », ou autre une fois signalée). */
  readonly label: string;
  readonly disabled: boolean;
  readonly pressed: boolean;
  readonly onClick: () => void;
}

/**
 * « Signaler l'image », en pastille ronde en bas à droite de l'image d'une carte (parent positionné) : déclenche
 * le bouton du site, caché.
 */
export function ReportButton({ label, disabled, pressed, onClick }: ReportButtonProps) {
  injectStyle('ui-report', CSS);
  return (
    <button
      type="button"
      class={`${buttonClass('round', { tone: pressed ? 'danger' : 'neutral', fill: 'solid', size: 'sm' })} wm-report`}
      aria-label={label}
      title={label}
      aria-pressed={pressed}
      disabled={disabled}
      onClick={(event) => {
        event.stopPropagation();
        onClick();
      }}
    >
      <Icon name="flag" size={15} />
    </button>
  );
}
