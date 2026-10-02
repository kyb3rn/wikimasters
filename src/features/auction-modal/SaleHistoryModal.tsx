import { useEffect, useState } from 'preact/hooks';
import type { Rarity } from '@/site/rarity';
import { confirmStep, type ConfirmStep } from '@/services/site-confirm';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import type { CardSales, SaleRecord } from './history';
import { SaleRow } from './SaleRow';
import { onCardSalesChange, removeSaleRecord } from './store';

export interface SaleHistoryModalProps {
  readonly sales: CardSales;
  readonly rarity: Rarity | undefined;
  readonly shiny: boolean;
  readonly onReuse: (record: SaleRecord) => void;
  readonly onClose: () => void;
}

/** Confirmation en deux clics, redessinée quand « Confirmer ? » s'active puis expire. */
function useConfirmStep<T>(): ConfirmStep<T> {
  const [, redraw] = useState(0);
  const [state] = useState(() => {
    const controller = new AbortController();
    return { controller, step: confirmStep<T>({ onChange: () => redraw((n) => n + 1), signal: controller.signal }) };
  });
  useEffect(() => () => state.controller.abort(), [state]);
  return state.step;
}

/** Toutes les mises en vente de la carte ; un clic en reprend une, la corbeille la retire (en deux clics). */
export function SaleHistoryModal({ sales: initial, rarity, shiny, onReuse, onClose }: SaleHistoryModalProps) {
  const [sales, setSales] = useState(initial);
  const step = useConfirmStep<number>();

  useEffect(() => {
    const controller = new AbortController();
    onCardSalesChange((next) => next.cardId === initial.cardId && setSales(next), { signal: controller.signal });
    return () => controller.abort();
  }, [initial.cardId]);

  const count = sales.records.length;
  return (
    <Modal
      title={sales.title || 'Mises en vente'}
      subtitle={`${count} mise${count > 1 ? 's' : ''} en vente`}
      width={600}
      padded
      onClose={onClose}
    >
      {count === 0 ? (
        <div class="wm-sale-muted">Plus aucune mise en vente.</div>
      ) : (
        <ul class="wm-sale-history-list">
          {sales.records.map((record) => {
            const stage = step.stage(record.at);
            return (
              <SaleRow key={record.at} record={record} rarity={rarity} shiny={shiny} onReuse={onReuse}>
                {stage === 'idle' ? (
                  <button
                    type="button"
                    class={buttonClass('round', { size: 'sm', tone: 'danger', fill: 'ghost' })}
                    title="Retirer de l'historique"
                    aria-label="Retirer de l'historique"
                    onClick={() => step.press(record.at)}
                  >
                    <Icon name="trash" size={14} />
                  </button>
                ) : (
                  <button
                    type="button"
                    class={buttonClass('standard', { size: 'sm', tone: 'danger', fill: 'solid' })}
                    disabled={stage === 'waiting'}
                    onClick={() => {
                      if (step.press(record.at)) void removeSaleRecord(sales.cardId, record.at);
                    }}
                  >
                    Confirmer ?
                  </button>
                )}
              </SaleRow>
            );
          })}
        </ul>
      )}
    </Modal>
  );
}
