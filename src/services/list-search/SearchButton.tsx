import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import type { SearchStatus } from './types';

const LABELS: Readonly<Record<SearchStatus, string>> = {
  search: 'Lancer la recherche',
  reload: 'Recharger la liste',
  loading: 'Chargement…',
};

export interface SearchButtonProps {
  readonly status: SearchStatus;
  readonly onClick: () => void;
  /** Classe propre à la page (repère des tests). */
  readonly name?: string;
}

/** Bouton carré vert au bout des filtres : loupe (choix changés), sinon rechargement ; roue pendant le chargement. */
export function SearchButton({ status, onClick, name }: SearchButtonProps) {
  const label = LABELS[status];
  return (
    <button
      type="button"
      class={[buttonClass('square', { tone: 'accent', fill: 'solid' }), 'wm-list-search', name].filter(Boolean).join(' ')}
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
