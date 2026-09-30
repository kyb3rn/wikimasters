import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

const LABEL = 'Gérer les étiquettes';

export function ManageButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button type="button" class={`${buttonClass('square')} wm-tag-manage`} aria-label={LABEL} title={LABEL} onClick={onClick}>
      <Icon name="settings" size={16} />
    </button>
  );
}
