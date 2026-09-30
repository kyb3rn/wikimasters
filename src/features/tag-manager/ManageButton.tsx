import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';

const LABEL = 'Gérer les étiquettes';

export function ManageButton({ onClick }: { readonly onClick: () => void }) {
  return (
    <button type="button" class={`${siteClass.listboxButton} wm-tag-manage`} aria-label={LABEL} title={LABEL} onClick={onClick}>
      <Icon name="settings" size={16} />
    </button>
  );
}
