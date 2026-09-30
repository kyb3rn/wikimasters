import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import type { SearchStatus } from './state';

const LABELS: Readonly<Record<SearchStatus, string>> = {
  search: 'Lancer la recherche',
  reload: 'Recharger la liste',
  loading: 'Chargement…',
};

export function SearchButton({ status, onClick }: { readonly status: SearchStatus; readonly onClick: () => void }) {
  const label = LABELS[status];
  return (
    <button
      type="button"
      class={`${siteClass.accentFieldButton} wm-collection-search`}
      data-status={status}
      disabled={status === 'loading'}
      aria-busy={status === 'loading'}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {status === 'loading' ? (
        <Icon name="spinner" size={20} class="wm-spin" />
      ) : (
        <Icon name={status === 'search' ? 'search' : 'reload'} size={20} />
      )}
    </button>
  );
}
