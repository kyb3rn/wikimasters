import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

/** Base de données juste à gauche de l'engrenage : petit rond gris ghost, comme lui. */
export function MemoryButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button
      type="button"
      class={buttonClass('round', { fill: 'ghost', size: 'sm' })}
      aria-label="Mémoire WikiMasters"
      title="Mémoire WikiMasters"
      onClick={onClick}
    >
      <Icon name="database" size={18} />
    </button>
  );
}
