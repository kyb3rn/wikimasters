import { CARD_MARK_REASONS } from '@/services/card-marks';
import { PackActionButton } from '@/services/pulls-pack';

/**
 * - `ready` : prêt à ouvrir la mise aux enchères de la carte ;
 * - `busy` : ouverture en cours (roue à la place du marteau) ;
 * - `blocked` : une autre action tient la carte (défausse en cours) ;
 * - `discarded` : la carte est défaussée ;
 * - `listed` : la carte est déjà aux enchères (exemplaire réservé par le site), cadenas ;
 * - `unavailable` : exemplaire inconnu, rien à mettre en vente.
 */
export type AuctionStatus = 'ready' | 'busy' | 'blocked' | 'discarded' | 'listed' | 'unavailable';

function title(status: AuctionStatus, reason: string | undefined): string {
  switch (status) {
    case 'ready':
      return 'Mettre aux enchères';
    case 'busy':
      return 'Ouverture de la mise aux enchères…';
    case 'blocked':
      return reason ?? 'Action en cours sur la carte';
    case 'discarded':
      return CARD_MARK_REASONS.discarded;
    case 'listed':
      return CARD_MARK_REASONS.listed;
    case 'unavailable':
      return 'Exemplaire introuvable : mise aux enchères impossible';
  }
}

export interface AuctionButtonProps {
  readonly status: AuctionStatus;
  /** Ce qui tient la carte (statut `blocked`). */
  readonly reason?: string;
  readonly onClick: () => void;
}

/** Rond vert en contour ; gris et cadenas quand la carte est déjà en vente. */
export function AuctionButton({ status, reason, onClick }: AuctionButtonProps) {
  return (
    <PackActionButton
      icon="gavel"
      tone="accent"
      status={status}
      label={title(status, reason)}
      enabled={status === 'ready'}
      busy={status === 'busy'}
      locked={status === 'listed'}
      className="wm-auction-quick"
      onClick={onClick}
    />
  );
}
