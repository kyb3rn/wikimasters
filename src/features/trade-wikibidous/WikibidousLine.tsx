import type { TradeSide } from '@/site/trades';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

export const titleFor = (value: number): string => (value > 0 ? 'Modifier les wikibidous' : 'Ajouter des wikibidous');

export interface WikibidousLineProps {
  readonly side: TradeSide;
  /** Montant déjà mis de ce côté. */
  readonly value: number;
  readonly onEdit: () => void;
}

/** Ligne en tête de l'onglet : montant de ce côté, et le bouton qui ouvre la fenêtre des wikibidous. */
export function WikibidousLine({ side, value, onEdit }: WikibidousLineProps) {
  return (
    <>
      <span class="wm-trade-wb-label">
        {side === 'mine' ? 'Wikibidous offerts :' : 'Wikibidous demandés :'}
        <span class="wm-trade-wb-amount" data-active={value > 0 ? '' : undefined}>
          {value.toLocaleString('fr-FR')}
          <Icon name="coin" size={16} />
        </span>
      </span>
      <button type="button" class={buttonClass('standard', value > 0 ? { tone: 'accent' } : {})} onClick={onEdit}>
        <Icon name="coins" size={16} />
        {titleFor(value)}
      </button>
    </>
  );
}
