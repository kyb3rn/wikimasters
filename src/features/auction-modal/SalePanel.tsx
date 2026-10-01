import { useEffect, useRef, useState } from 'preact/hooks';
import { buttonClass } from '@/ui/button';
import { ChoiceField, CloseButton } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { useModalBehavior } from '@/ui/modal';
import { siteClass } from '@/ui/site';

export interface DurationChoice {
  readonly label: string;
  readonly minutes: number;
  readonly active: boolean;
}

export interface SaleActions {
  readonly onPrice: (price: string) => void;
  readonly onDuration: (minutes: number) => void;
  readonly onCancel: () => void;
  readonly onConfirm: () => void;
}

export interface SalePanelProps extends SaleActions {
  /** Copie de la face du site, insérée telle quelle. */
  readonly card: HTMLElement | undefined;
  readonly cardTitle: string;
  readonly initialPrice: string;
  readonly durations: readonly DurationChoice[];
  readonly quota: { readonly active: number; readonly max: number } | undefined;
  readonly error: string | undefined;
  readonly sending: boolean;
  readonly canConfirm: boolean;
}

/** Mise en vente : la carte à gauche ; à droite enchères actives, mise de départ, durée, Annuler / Confirmer. */
export function SalePanel(props: SalePanelProps) {
  const { card, cardTitle, durations, quota, error, sending, canConfirm } = props;
  const [price, setPrice] = useState(props.initialPrice);
  const input = useRef<HTMLInputElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Échap ne va pas jusqu'à la modale de carte du site, en dessous : elle se fermerait aussi.
  useModalBehavior({ overlay: backdrop, frame: panel, onClose: props.onCancel, locked: sending });

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  useEffect(() => {
    if (card) cardSlot.current?.replaceChildren(card);
  }, [card]);

  const change = (next: string) => {
    setPrice(next);
    props.onPrice(next);
  };
  const step = (delta: number) => {
    const current = Math.round(Number(price));
    change(String(Math.max(1, (Number.isFinite(current) ? current : 1) + delta)));
  };
  const cancel = () => {
    if (!sending) props.onCancel();
  };

  const left = quota ? Math.max(0, quota.max - quota.active) : undefined;
  const full = left === 0;
  const warning =
    !error && full && quota
      ? `Limite de ${quota.max} enchères actives atteinte : retirer une vente du marché ou attendre la fin d'une enchère.`
      : undefined;

  return (
    <div ref={backdrop} class="wm-sale-backdrop">
      <div ref={panel} class="wm-sale" role="dialog" aria-modal="true" aria-label="Mise en vente" tabIndex={-1}>
        <CloseButton class={siteClass.closeButtonPosition} disabled={sending} onClick={cancel} />
        {(error ?? warning) && (
          <div class={cx('wm-sale-status', error ? siteClass.formError : 'wm-sale-warning')} role="alert">
            {error ?? warning}
          </div>
        )}
        <div class="wm-sale-columns">
          <div class="wm-sale-card">{card ? <div ref={cardSlot} /> : <div class="wm-sale-noface">{cardTitle}</div>}</div>
          <div class="wm-sale-form">
            <div class="wm-sale-title">Mise en vente</div>
            <div class="wm-sale-quota" data-full={full || undefined}>
              Enchères actives :{' '}
              {quota && left !== undefined ? (
                <>
                  <b>
                    {quota.active} / {quota.max}
                  </b>
                  {' · '}
                  {full ? 'plus de place disponible' : `${left} restante${left > 1 ? 's' : ''}`}
                </>
              ) : (
                <span class="wm-sale-muted">…</span>
              )}
            </div>
            <div class="wm-sale-note">Un exemplaire sera mis en réserve pour la durée de l'enchère.</div>
            <div class="wm-sale-field">
              <span class={siteClass.fieldLabel}>Mise de départ</span>
              <div class={siteClass.stepper}>
                <button
                  type="button"
                  class={`${siteClass.stepperButton} ${siteClass.stepperMinus}`}
                  aria-label="Diminuer"
                  tabIndex={-1}
                  disabled={sending}
                  onClick={() => step(-1)}
                >
                  <Icon name="minus" size={16} />
                </button>
                <span class={siteClass.stepperCoin}>
                  <Icon name="coin" class={siteClass.stepperCoinIcon} />
                </span>
                <input
                  ref={input}
                  type="number"
                  inputMode="numeric"
                  min={1}
                  step={1}
                  class={siteClass.stepperInput}
                  aria-label="Mise de départ"
                  value={price}
                  disabled={sending}
                  onInput={(event) => change(event.currentTarget.value)}
                  onKeyDown={(event) => {
                    if (event.key !== 'Enter') return;
                    event.preventDefault();
                    if (canConfirm) props.onConfirm();
                  }}
                />
                <button
                  type="button"
                  class={`${siteClass.stepperButton} ${siteClass.stepperPlus}`}
                  aria-label="Augmenter"
                  tabIndex={-1}
                  disabled={sending}
                  onClick={() => step(1)}
                >
                  <Icon name="plus" size={16} />
                </button>
              </div>
            </div>
            <div class="wm-sale-field">
              <span class={siteClass.fieldLabel}>Durée</span>
              <ChoiceField
                label="Durée"
                value={durations.find((duration) => duration.active)?.minutes ?? -1}
                options={durations.map(({ minutes, label }) => ({ value: minutes, label }))}
                disabled={sending}
                onChange={props.onDuration}
              />
            </div>
            <div class="wm-sale-actions">
              <button type="button" class={buttonClass('window')} disabled={sending} onClick={cancel}>
                Annuler
              </button>
              <button
                type="button"
                class={buttonClass('window', { tone: 'accent', fill: 'solid' })}
                disabled={!canConfirm}
                aria-busy={sending}
                onClick={() => props.onConfirm()}
              >
                {sending && <Icon name="spinner" size={16} />}
                {sending ? 'Mise en vente…' : 'Confirmer'}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
