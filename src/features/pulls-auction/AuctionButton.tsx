import { CAROUSEL_ACTION } from '@/services/pulls-pack';
import { Icon } from '@/ui/icons';

/**
 * - `ready` : prêt à ouvrir la mise aux enchères de la carte affichée ;
 * - `busy` : ouverture en cours (roue à la place du marteau) ;
 * - `blocked` : une autre action tient la carte (défausse en cours) ;
 * - `discarded` : la carte affichée est défaussée ;
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
      return 'Carte défaussée';
    case 'listed':
      return 'Carte déjà aux enchères';
    case 'unavailable':
      return 'Exemplaire introuvable : mise aux enchères impossible';
  }
}

export interface AuctionButtonProps {
  /** Classes des flèches du site : même allure, le vert vient de `wm-auction-quick`. */
  readonly className: string;
  readonly status: AuctionStatus;
  /** Ce qui tient la carte (statut `blocked`). */
  readonly reason?: string;
  readonly onClick: () => void;
}

export function AuctionButton({ className, status, reason, onClick }: AuctionButtonProps) {
  const label = title(status, reason);
  const icon =
    status === 'busy' ? (
      <Icon name="spinner" size={22} class="wm-spin" />
    ) : (
      <Icon name={status === 'listed' ? 'lock' : 'gavel'} size={20} />
    );
  return (
    <button
      type="button"
      class={`${className} wm-auction-quick ${CAROUSEL_ACTION}`}
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
