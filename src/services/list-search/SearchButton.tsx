import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import type { SearchStatus } from './types';

const LABELS: Readonly<Record<SearchStatus, string>> = {
  search: 'Lancer la recherche',
  reload: 'Recharger la liste',
  loading: 'Chargement…',
};

/** Classe commune des boutons de recherche (la propre à chaque page : `name`). */
export const SEARCH_BUTTON_CLASS = 'wm-list-search';

/**
 * Feuille d'une ligne de filtres à 12 px d'écart (`line` : son sélecteur) : le bouton de la recherche y reste à 8 px
 * du contrôle qui le précède, comme dans la rangée des listes de la Collection.
 */
export const snugSearchButtonCss = (line: string): string => `${line} .${SEARCH_BUTTON_CLASS} { margin-left: -0.25rem; }`;

export interface SearchButtonProps {
  readonly status: SearchStatus;
  readonly onClick: () => void;
  /** Classe propre à la page (repère des tests). */
  readonly name?: string;
  /** Rien à lancer pour l'instant (une autre requête de la liste est en cours). */
  readonly disabled?: boolean;
}

/** Bouton carré vert au bout des filtres : loupe (choix changés), sinon rechargement ; roue pendant le chargement. */
export function SearchButton({ status, onClick, name, disabled = false }: SearchButtonProps) {
  const label = LABELS[status];
  const loading = status === 'loading';
  return (
    <button
      type="button"
      class={cx(buttonClass('square', { tone: 'accent', fill: 'solid' }), SEARCH_BUTTON_CLASS, name)}
      data-status={status}
      disabled={loading || disabled}
      aria-busy={loading}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      <Icon name={status === 'search' ? 'search' : 'reload'} busy={loading} size={20} />
    </button>
  );
}
