import { Icon } from '@/ui/icons';

export interface GearButtonProps {
  /** Classes du bouton du solde : même allure, juste à sa gauche. */
  readonly className: string;
  readonly onClick: () => void;
}

export function GearButton({ className, onClick }: GearButtonProps) {
  return (
    <button
      type="button"
      class={`${className} wm-gear`}
      aria-label="Paramètres WikiMasters"
      title="Paramètres WikiMasters"
      onClick={onClick}
    >
      <Icon name="settings" size={16} />
    </button>
  );
}
