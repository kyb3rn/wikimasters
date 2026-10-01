import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

export interface LoadErrorProps {
  readonly message: string;
  /** Nouvel essai en cours : roue, bouton désactivé. */
  readonly busy: boolean;
  readonly onRetry: () => void;
}

/** Liste qui n'a pas pu se charger, dans le cadre de la liste vide du marché : grande icône, texte, « Réessayer ». */
export function LoadError({ message, busy, onRetry }: LoadErrorProps) {
  return (
    <div class={siteClass.emptyFrame} role="alert">
      <Icon name="wifi-off" size={32} class={siteClass.emptyIcon} />
      <p class={siteClass.emptyText}>{message}</p>
      <button
        type="button"
        class={buttonClass('standard', { tone: 'accent', fill: 'solid' })}
        disabled={busy}
        aria-busy={busy}
        onClick={onRetry}
      >
        <Icon name="reload" busy={busy} size={16} />
        Réessayer
      </button>
    </div>
  );
}
