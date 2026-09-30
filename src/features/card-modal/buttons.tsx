import { Icon } from '@/ui/icons';

export interface ReportButtonProps {
  /** Texte du bouton d'origine du site (« Signaler l'image », ou autre une fois signalée). */
  readonly label: string;
  readonly disabled: boolean;
  readonly pressed: boolean;
  readonly onClick: () => void;
}

/** « Signaler l'image », en pastille ronde sur l'image de la carte : déclenche le bouton du site (caché). */
export function ReportButton({ label, disabled, pressed, onClick }: ReportButtonProps) {
  return (
    <button
      type="button"
      class="wm-report"
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

export interface MarketButtonProps {
  /** Classes du bouton « Défausser » d'origine (allure grise du site), avant qu'on le passe en rouge. */
  readonly className: string;
  /** Ventes en cours de chargement. */
  readonly busy: boolean;
  /** Raison pour laquelle l'historique ne s'ouvre pas (compte non PRO) : bouton désactivé. */
  readonly unavailable: string | undefined;
  readonly onClick: () => void;
}

/** « Marché », au centre des actions : ouvre l'historique des ventes de la carte, par-dessus la modale. */
export function MarketButton({ className, busy, unavailable, onClick }: MarketButtonProps) {
  return (
    <button
      type="button"
      class={`${className} wm-market-button`}
      disabled={busy || unavailable !== undefined}
      aria-busy={busy}
      title={unavailable ?? 'Historique des ventes de la carte'}
      onClick={onClick}
    >
      <Icon name={busy ? 'spinner' : 'market'} size={16} class={busy ? 'wm-spin' : undefined} />
      Marché
    </button>
  );
}
