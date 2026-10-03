import type { JSX } from 'preact';
import { formatNumber } from '@/services/market';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';

export interface WishedPriceButtonProps {
  /** Prix souhaité ; aucun : `undefined`. */
  readonly price: number | undefined;
  readonly onClick: () => void;
}

/** Sous la carte : un clic sur le bouton n'ouvre pas la carte. */
const stay = (event: JSX.TargetedMouseEvent<HTMLElement>) => {
  event.preventDefault();
  event.stopPropagation();
};

/**
 * Prix souhaité de la carte, mauve, très petit, à gauche du prix moyen : crayon seul sans prix (ghost), pièce et montant
 * avec (plein). Ouvre la fenêtre du prix souhaité.
 */
export function WishedPriceButton({ price, onClick }: WishedPriceButtonProps) {
  const title = price === undefined ? 'Fixer le prix souhaité' : `Prix souhaité : ${formatNumber(price)} wb. Clic : le changer.`;
  return (
    <div class="wm-resale-wished" onClick={stay} onAuxClick={stay}>
      {price === undefined ? (
        <button type="button" class={buttonClass('round', { tone: 'violet', fill: 'ghost', size: 'xs' })} aria-label={title} title={title} onClick={onClick}>
          <Icon name="pencil" size={12} />
        </button>
      ) : (
        <button
          type="button"
          class={buttonClass('standard', { tone: 'violet', fill: 'solid', size: 'xs', pill: true })}
          aria-label={title}
          title={title}
          onClick={onClick}
        >
          <Icon name="coin" size={12} />
          {formatNumber(price)}
        </button>
      )}
    </div>
  );
}
