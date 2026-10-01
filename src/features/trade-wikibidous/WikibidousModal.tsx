import { useEffect, useRef, useState } from 'preact/hooks';
import { parseTradeWikibidous, TRADE_WIKIBIDOUS_MAX } from '@/site/trades';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';

export interface WikibidousModalProps {
  readonly title: string;
  /** « Wikibidous que j'offre », « Wikibidous demandés à … ». */
  readonly label: string;
  readonly value: number;
  /** Solde du joueur, pour ce qu'il offre. */
  readonly max: number | undefined;
  readonly onSave: (value: number) => void;
  readonly onClose: () => void;
}

/** Pas des boutons − et +. */
const STEP = 10;

const format = (value: number) => value.toLocaleString('fr-FR');

/** Montant de wikibidous d'un côté de l'échange : champ de la mise du site, solde, Annuler · Enregistrer. */
export function WikibidousModal({ title, label, value, max, onSave, onClose }: WikibidousModalProps) {
  const [text, setText] = useState(value > 0 ? String(value) : '');
  const input = useRef<HTMLInputElement>(null);
  const amount = parseTradeWikibidous(text);
  const tooHigh = max !== undefined && amount > max;
  const save = () => {
    if (!tooHigh) onSave(amount);
  };
  const step = (delta: number) => {
    const next = Math.min(TRADE_WIKIBIDOUS_MAX, Math.max(0, amount + delta));
    setText(next > 0 ? String(next) : '');
  };

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  return (
    <Modal title={title} subtitle={label} width={420} padded onClose={onClose}>
      <div class="wm-trade-wb">
        <div class={siteClass.stepper} data-invalid={tooHigh || undefined}>
          <button
            type="button"
            class={`${siteClass.stepperButton} ${siteClass.stepperMinus}`}
            aria-label="Diminuer"
            tabIndex={-1}
            disabled={amount <= 0}
            onClick={() => step(-STEP)}
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
            min={0}
            max={TRADE_WIKIBIDOUS_MAX}
            step={1}
            placeholder="0"
            class={siteClass.stepperInput}
            aria-label={label}
            aria-invalid={tooHigh}
            value={text}
            onInput={(event) => setText(event.currentTarget.value)}
            onKeyDown={(event) => {
              if (event.key !== 'Enter') return;
              event.preventDefault();
              save();
            }}
          />
          <span class={siteClass.stepperUnit}>wb</span>
          <button
            type="button"
            class={`${siteClass.stepperButton} ${siteClass.stepperPlus}`}
            aria-label="Augmenter"
            tabIndex={-1}
            disabled={amount >= TRADE_WIKIBIDOUS_MAX}
            onClick={() => step(STEP)}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <p class="wm-trade-wb-note" data-error={tooHigh || undefined}>
          {tooHigh && max !== undefined
            ? `Solde insuffisant : ${format(max)} wb`
            : max !== undefined
              ? `Solde : ${format(max)} wb`
              : `${format(TRADE_WIKIBIDOUS_MAX)} wb au plus`}
        </p>
        <div class="wm-trade-wb-actions">
          <button type="button" class={buttonClass('window')} onClick={onClose}>
            Annuler
          </button>
          <button type="button" class={buttonClass('window', { tone: 'accent', fill: 'solid' })} disabled={tooHigh} onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}
