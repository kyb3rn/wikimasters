import { CAROUSEL_ACTION } from '@/services/pulls-pack';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

/**
 * - `ready` : prêt à défausser la carte affichée ;
 * - `busy` : requête en cours (roue à la place de la corbeille) ;
 * - `blocked` : une autre action tient la carte affichée (ouverture de la mise aux enchères) ;
 * - `discarded` : la carte affichée est déjà défaussée ;
 * - `listed` : la carte est aux enchères (exemplaire réservé par le site), cadenas ;
 * - `protected` : défausse refusée par une protection (favori, étiquette…), cadenas ;
 * - `unavailable` : exemplaire inconnu, défausse impossible.
 */
export type DiscardStatus = 'ready' | 'busy' | 'blocked' | 'discarded' | 'listed' | 'protected' | 'unavailable';

function title(status: DiscardStatus, reason: string | undefined, advance: boolean): string {
  switch (status) {
    case 'ready':
      return advance ? 'Défausser et passer à la suivante' : 'Défausser';
    case 'busy':
      return 'Défausse en cours…';
    case 'blocked':
      return reason ?? 'Action en cours sur la carte';
    case 'discarded':
      return 'Carte déjà défaussée';
    case 'listed':
      return 'Carte mise aux enchères';
    case 'protected':
      return `Protégée : ${reason ?? 'défausse verrouillée'}`;
    case 'unavailable':
      return 'Exemplaire introuvable : défausse impossible';
  }
}

export interface DiscardButtonProps {
  readonly status: DiscardStatus;
  /** Raison de la protection (statut `protected`) ou action qui tient la carte (`blocked`). */
  readonly reason?: string;
  /** Carrousel : passe ensuite à la carte suivante. */
  readonly advance: boolean;
  readonly onClick: () => void;
}

/** Rond rouge en contour, comme les flèches du carrousel ; gris quand la carte est protégée ou en vente (cadenas). */
export function DiscardButton({ status, reason, advance, onClick }: DiscardButtonProps) {
  const label = title(status, reason, advance);
  const locked = status === 'protected' || status === 'listed';
  const icon = status === 'busy' ? <Icon name="spinner" size={20} class="wm-spin" /> : <Icon name={locked ? 'lock' : 'trash'} size={20} />;
  return (
    <button
      type="button"
      class={`${buttonClass('round', { tone: locked ? 'neutral' : 'danger' })} wm-discard-next ${CAROUSEL_ACTION}`}
      data-status={status}
      disabled={status !== 'ready'}
      aria-busy={status === 'busy'}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}
