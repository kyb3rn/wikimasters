import { CARD_MARK_REASONS } from '@/services/card-marks';
import { PackActionButton } from '@/services/pulls-pack';

/**
 * - `ready` : prêt à défausser la carte ;
 * - `busy` : requête en cours (roue à la place de la corbeille) ;
 * - `blocked` : une autre action tient la carte (ouverture de la mise aux enchères) ;
 * - `discarded` : la carte est déjà défaussée ;
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
      return CARD_MARK_REASONS.discarded;
    case 'listed':
      return CARD_MARK_REASONS.listed;
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

/** Rond rouge en contour ; gris et cadenas quand la carte est protégée ou en vente. */
export function DiscardButton({ status, reason, advance, onClick }: DiscardButtonProps) {
  return (
    <PackActionButton
      icon="trash"
      tone="danger"
      status={status}
      label={title(status, reason, advance)}
      enabled={status === 'ready'}
      busy={status === 'busy'}
      locked={status === 'protected' || status === 'listed'}
      className="wm-discard-next"
      onClick={onClick}
    />
  );
}
