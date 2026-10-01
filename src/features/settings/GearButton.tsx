import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

/** Engrenage juste à gauche du bouton du solde : petit rond gris ghost, à sa hauteur. */
export function GearButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      class={buttonClass('round', { fill: 'ghost', size: 'sm' })}
      aria-label="Paramètres WikiMasters"
      title="Paramètres WikiMasters"
      onClick={onClick}
    >
      <Icon name="settings" size={18} />
    </button>
  );
}
