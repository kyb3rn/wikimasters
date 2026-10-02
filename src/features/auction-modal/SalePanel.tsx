import { useEffect, useRef, useState } from 'preact/hooks';
import type { Rarity } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { ChoiceField, CloseButton } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { useModalBehavior } from '@/ui/modal';
import { siteClass } from '@/ui/site';
import type { SaleRecord } from './history';
import { SaleRow } from './SaleRow';

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

/** Les mises en vente de la carte (de la plus récente à la plus ancienne), sous la durée. */
export interface SaleHistory {
  /** `undefined` pendant la lecture. */
  readonly records: readonly SaleRecord[] | undefined;
  /** Rareté de l'exemplaire à vendre. */
  readonly rarity: Rarity | undefined;
  readonly shiny: boolean;
  readonly onReuse: (record: SaleRecord) => void;
  readonly onShowAll: () => void;
}

/** Mise et durée à reprendre d'une mise en vente. */
export interface SaleFill {
  readonly record: SaleRecord;
  /** Change à chaque demande : la même mise en vente peut être reprise deux fois. */
  readonly seq: number;
  /** Reprise à l'ouverture : abandonnée si la mise ou la durée ont déjà été changées. */
  readonly auto: boolean;
}

/** Mises en vente montrées sous la durée ; les autres dans la modale « Tout voir ». */
const RECENT = 3;

export interface SalePanelProps extends SaleActions {
  /** Copie de la face du site, insérée telle quelle. */
  readonly card: HTMLElement | undefined;
  readonly cardTitle: string;
  readonly initialPrice: string;
  readonly durations: readonly DurationChoice[];
  readonly quota: { readonly active: number; readonly max: number } | undefined;
  readonly error: string | undefined;
  readonly sending: boolean;
  /** « Vérification rapide » du site ouverte par-dessus : tout attend qu'elle soit faite ou annulée. */
  readonly verifying: boolean;
  readonly canConfirm: boolean;
  /** Absent : historique masqué (réglage), ou carte illisible. */
  readonly history: SaleHistory | undefined;
  readonly fill: SaleFill | undefined;
}

/** Mise en vente : la carte à gauche ; à droite enchères actives, mise de départ, durée, Annuler / Confirmer. */
export function SalePanel(props: SalePanelProps) {
  const { card, cardTitle, durations, quota, error, sending, verifying, canConfirm, history, fill } = props;
  const busy = sending || verifying;
  const [price, setPrice] = useState(props.initialPrice);
  /** Mise ou durée changées à la main : la reprise à l'ouverture n'écrase rien. */
  const touched = useRef(false);
  const input = useRef<HTMLInputElement>(null);
  const cardSlot = useRef<HTMLDivElement>(null);
  const backdrop = useRef<HTMLDivElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  // Échap ne va pas jusqu'à la modale de carte du site, en dessous : elle se fermerait aussi.
  useModalBehavior({ overlay: backdrop, frame: panel, onClose: props.onCancel, locked: busy });

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
  const edit = (next: string) => {
    touched.current = true;
    change(next);
  };
  const step = (delta: number) => {
    const current = Math.round(Number(price));
    edit(String(Math.max(1, (Number.isFinite(current) ? current : 1) + delta)));
  };

  useEffect(() => {
    if (!fill || (fill.auto && touched.current)) return;
    change(String(fill.record.price));
    if (fill.record.minutes !== undefined) props.onDuration(fill.record.minutes);
    input.current?.focus();
    input.current?.select();
    // Une fois par demande (`seq`), pas à chaque rendu.
  }, [fill?.seq]);
  const cancel = () => {
    if (!busy) props.onCancel();
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
        <CloseButton class={siteClass.closeButtonPosition} disabled={busy} onClick={cancel} />
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
                  disabled={busy}
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
                  disabled={busy}
                  onInput={(event) => edit(event.currentTarget.value)}
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
                  disabled={busy}
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
                disabled={busy}
                onChange={(minutes) => {
                  touched.current = true;
                  props.onDuration(minutes);
                }}
              />
            </div>
            {history?.records && <HistoryField history={history} records={history.records} disabled={busy} />}
            <div class="wm-sale-actions">
              <button type="button" class={buttonClass('window')} disabled={busy} onClick={cancel}>
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

function HistoryField({ history, records, disabled }: { history: SaleHistory; records: readonly SaleRecord[]; disabled: boolean }) {
  return (
    <div class="wm-sale-field">
      <div class="wm-sale-history-head">
        <span class={siteClass.fieldLabel}>Dernières mises en vente</span>
        {records.length > RECENT && (
          <button type="button" class={buttonClass('standard', { size: 'xs', fill: 'ghost' })} disabled={disabled} onClick={history.onShowAll}>
            Tout voir ({records.length})
          </button>
        )}
      </div>
      {records.length === 0 ? (
        <div class="wm-sale-muted">Jamais mise en vente.</div>
      ) : (
        <ul class="wm-sale-history-list">
          {records.slice(0, RECENT).map((record) => (
            <SaleRow
              key={record.at}
              record={record}
              rarity={history.rarity}
              shiny={history.shiny}
              disabled={disabled}
              onReuse={history.onReuse}
            />
          ))}
        </ul>
      )}
    </div>
  );
}
