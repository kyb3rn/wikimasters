import { buttonClass, type ButtonTone } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon, type IconName } from '@/ui/icons';
import { CAROUSEL_ACTION } from './lock';

export interface PackActionButtonProps {
  readonly icon: IconName;
  /** Couleur de l'action (rouge : défausse, vert : enchère). */
  readonly tone: ButtonTone;
  /** État de l'action (`data-status`), pour les tests. */
  readonly status: string;
  /** Info-bulle et nom du bouton : ce qu'il fait, ou pourquoi il est désactivé. */
  readonly label: string;
  readonly enabled: boolean;
  /** Action en cours : la roue à la place de l'icône. */
  readonly busy: boolean;
  /** Carte réservée (protégée, déjà en vente) : gris, cadenas. */
  readonly locked: boolean;
  /** Classe propre au bouton. */
  readonly className: string;
  readonly onClick: () => void;
}

/** Bouton d'action sur une carte du paquet : rond moyen en contour, comme les flèches du carrousel. */
export function PackActionButton({ icon, tone, status, label, enabled, busy, locked, className, onClick }: PackActionButtonProps) {
  return (
    <button
      type="button"
      class={cx(buttonClass('round', { tone: locked ? 'neutral' : tone }), className, CAROUSEL_ACTION)}
      data-status={status}
      disabled={!enabled}
      aria-busy={busy}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon name={locked ? 'lock' : icon} busy={busy} size={20} />
    </button>
  );
}
