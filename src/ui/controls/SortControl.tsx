import { injectStyle } from '@/core/dom';
import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { tokens } from '@/ui/theme';
import { Listbox, type ListboxOption } from './Listbox';

export type SortOrder = 'asc' | 'desc';

// Un seul contrôle : un trait commun entre la liste et le bouton du sens, angles intérieurs droits, le bouton sur le
// fond de la liste. Le bouton de la liste remplit sa case sans dépendre de son `w-full`.
const CSS = `
.wm-sort { display: flex; align-items: stretch; min-width: 0; }
.wm-sort-list { flex: 1 1 auto; min-width: 0; }
.wm-sort-list > button { width: 100%; border-top-right-radius: 0; border-bottom-right-radius: 0; }
.wm-sort > .wm-sort-order { margin-left: -1px; border-top-left-radius: 0; border-bottom-left-radius: 0;
  background-color: ${tokens.surfaceLight}; }
`;

export interface SortControlProps {
  readonly ariaLabel: string;
  readonly value: string;
  readonly options: readonly ListboxOption[];
  readonly order: SortOrder;
  /** Ce que dit le sens actuel (« De A à Z ») : info-bulle du bouton du sens. */
  readonly orderLabel: string;
  readonly onChange: (value: string) => void;
  readonly onOrderChange: (order: SortOrder) => void;
  /** Classes du contrôle (largeur dans sa rangée). */
  readonly class?: string;
}

/** Liste du tri (celle du site) et, collé à sa droite, le bouton du sens : un clic l'inverse. */
export function SortControl({ ariaLabel, value, options, order, orderLabel, onChange, onOrderChange, class: extra }: SortControlProps) {
  injectStyle('ui-sort', CSS);
  return (
    <div class={cx('wm-sort', extra)}>
      <Listbox ariaLabel={ariaLabel} class="wm-sort-list" value={value} options={options} onChange={onChange} />
      <button
        type="button"
        class={cx(buttonClass('square'), 'wm-sort-order')}
        data-order={order}
        aria-label={`Sens du tri : ${orderLabel}`}
        title={`${orderLabel}. Clic : inverser.`}
        onClick={() => onOrderChange(order === 'asc' ? 'desc' : 'asc')}
      >
        <Icon name={order === 'asc' ? 'sortAscending' : 'sortDescending'} size={18} />
      </button>
    </div>
  );
}
