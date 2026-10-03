import { useEffect, useRef, useState } from 'preact/hooks';
import { formatNumber } from '@/services/market';
import { isWishedPriceValue, WISHED_PRICE_MAX } from '@/services/wished-price';
import { RARITY_NAMES, rarityBadgeStyle, type Rarity } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { Icon } from '@/ui/icons';
import { Modal } from '@/ui/modal';
import { siteClass } from '@/ui/site';

export interface WishedPriceModalProps {
  readonly title: string;
  readonly rarity: Rarity;
  readonly shiny: boolean;
  /** Prix souhaité actuel ; aucun : `undefined`. */
  readonly current: number | undefined;
  /** Repère : moyenne des 7 dernières ventes de la rareté, si elle est en cache. */
  readonly average: number | undefined;
  /** Prix valide, ou `undefined` pour le retirer. */
  readonly onSave: (price: number | undefined) => void;
  readonly onClose: () => void;
}

/** Pas des boutons − et + (comme la mise de départ). */
const STEP = 10;

/** Texte saisi : entier positif, blancs tolérés (« 1 500 ») ; sinon `undefined`. */
export function parseWishedPriceText(text: string): number | undefined {
  const compact = text.replace(/\s/g, '');
  if (!/^\d+$/.test(compact)) return undefined;
  const value = Number(compact);
  return isWishedPriceValue(value) ? value : undefined;
}

/**
 * Prix souhaité d'une carte dans la rareté de l'exemplaire : titre de la carte et badge de sa rareté, champ comme la
 * mise de départ (− · pièce · valeur · wb · +), repère des ventes, Annuler · Enregistrer (Entrée), et Retirer quand
 * un prix existe.
 */
export function WishedPriceModal({ title, rarity, shiny, current, average, onSave, onClose }: WishedPriceModalProps) {
  const [text, setText] = useState(current === undefined ? '' : String(current));
  const input = useRef<HTMLInputElement>(null);
  const value = parseWishedPriceText(text);
  const save = () => {
    if (value !== undefined) onSave(value);
  };
  const step = (delta: number) => {
    const next = Math.min(WISHED_PRICE_MAX, Math.max(STEP, (value ?? 0) + delta));
    setText(String(next));
  };

  useEffect(() => {
    input.current?.focus();
    input.current?.select();
  }, []);

  const badge = (
    <span class={siteClass.rarityBadge} style={rarityBadgeStyle(rarity)} title={`${RARITY_NAMES[rarity]}${shiny ? ' shiny' : ''}`}>
      {rarity}
      {shiny && '✦'}
    </span>
  );

  return (
    <Modal title={title} titleBefore={badge} subtitle="Prix souhaité" width={420} padded onClose={onClose}>
      <div class="wm-resale-wished-form">
        <div class={siteClass.stepper} data-invalid={(text.trim() !== '' && value === undefined) || undefined}>
          <button
            type="button"
            class={`${siteClass.stepperButton} ${siteClass.stepperMinus}`}
            aria-label="Diminuer"
            tabIndex={-1}
            disabled={value === undefined || value <= STEP}
            onClick={() => step(-STEP)}
          >
            <Icon name="minus" size={16} />
          </button>
          <span class={siteClass.stepperCoin}>
            <Icon name="coin" class={siteClass.stepperCoinIcon} />
          </span>
          <input
            ref={input}
            type="text"
            inputMode="numeric"
            placeholder="Prix"
            class={siteClass.stepperInput}
            aria-label="Prix souhaité"
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
            disabled={value !== undefined && value >= WISHED_PRICE_MAX}
            onClick={() => step(STEP)}
          >
            <Icon name="plus" size={16} />
          </button>
        </div>
        <p class="wm-resale-wished-note">
          {average === undefined ? 'Aucune vente en cache dans cette rareté.' : `Moyenne des 7 dernières ventes : ${formatNumber(average)} wb`}
        </p>
        <div class="wm-resale-wished-actions">
          {current !== undefined && (
            <button type="button" class={buttonClass('window', { tone: 'danger' })} onClick={() => onSave(undefined)}>
              Retirer
            </button>
          )}
          <button type="button" class={buttonClass('window')} onClick={onClose}>
            Annuler
          </button>
          <button type="button" class={buttonClass('window', { tone: 'violet', fill: 'solid' })} disabled={value === undefined} onClick={save}>
            Enregistrer
          </button>
        </div>
      </div>
    </Modal>
  );
}
