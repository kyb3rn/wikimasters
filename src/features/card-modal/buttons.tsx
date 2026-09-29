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
  /** Vue marché affichée. */
  readonly active: boolean;
  readonly onClick: () => void;
}

/** « Marché », au centre des actions : bascule la vue marché de la modale (onglet du site caché). */
export function MarketButton({ className, active, onClick }: MarketButtonProps) {
  return (
    <button
      type="button"
      class={`${className} wm-market-button`}
      aria-pressed={active}
      title={active ? 'Revenir aux détails de la carte' : 'Voir le marché de la carte'}
      onClick={onClick}
    >
      <Icon name="market" size={16} />
      Marché
    </button>
  );
}
