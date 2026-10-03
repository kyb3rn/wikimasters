import { useEffect, useReducer } from 'preact/hooks';
import { formatNumber } from '@/services/market';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { isWishedPriceValue, onWishedPricesChange, setWishedPrice, shownInSale, wishedPrice, type WishedPriceCard } from './store';

export interface SaleWishedPriceProps {
  /** La carte et la rareté de l'exemplaire mis en vente. */
  readonly card: WishedPriceCard;
  /** Mise de départ telle que saisie. */
  readonly bid: string;
  /** Reprendre un montant comme mise (comme une ligne de l'historique). */
  readonly onTake: (price: number) => void;
  readonly disabled: boolean;
}

/** Mise saisie : entier positif, sinon `undefined`. */
const parseBid = (text: string): number | undefined => {
  const value = Number(text.trim());
  return text.trim() !== '' && isWishedPriceValue(value) ? value : undefined;
};

/**
 * Sous la mise de départ (demande de l'utilisateur) : le prix souhaité de la carte dans cette rareté, un clic le
 * reprend comme mise ; si la mise en diffère, l'enregistrer comme prix souhaité (ou le mettre à jour, ancien et
 * nouveau montants). Rien quand la mise est vide ou invalide, ni quand elle vaut déjà le prix souhaité. Enregistré
 * aussitôt, sans fermer la fenêtre.
 */
export function SaleWishedPrice({ card, bid, onTake, disabled }: SaleWishedPriceProps) {
  const [, bump] = useReducer((count: number) => count + 1, 0);
  useEffect(() => {
    const controller = new AbortController();
    onWishedPricesChange(() => bump(undefined), { signal: controller.signal });
    return () => controller.abort();
  }, []);
  if (!shownInSale()) return null;

  const wished = wishedPrice(card)?.price;
  const value = parseBid(bid);
  const save = value !== undefined && value !== wished ? value : undefined;
  if (wished === undefined && save === undefined) return null;

  return (
    <div class="wm-sale-wished">
      {wished !== undefined && (
        <button
          type="button"
          class={buttonClass('standard', { tone: 'violet', fill: 'ghost', size: 'xs' })}
          title="Reprendre le prix souhaité comme mise"
          disabled={disabled}
          onClick={() => onTake(wished)}
        >
          Prix souhaité :
          <Icon name="coin" size={12} />
          <b>{formatNumber(wished)}</b>
        </button>
      )}
      {save !== undefined && (
        <button
          type="button"
          class={buttonClass('standard', { tone: 'violet', fill: 'outline', size: 'xs' })}
          disabled={disabled}
          onClick={() => setWishedPrice(card, save)}
        >
          <Icon name="pencil" size={12} />
          {wished === undefined ? 'Enregistrer comme prix souhaité' : `Mettre à jour le prix souhaité : ${formatNumber(wished)} → ${formatNumber(save)}`}
        </button>
      )}
    </div>
  );
}
