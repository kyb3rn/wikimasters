import type { ComponentChildren } from 'preact';
import { RARITY_NAMES, rarityBadgeStyle, type Rarity } from '@/site/rarity';
import { ageText, formatNumber, formatTime, shortDate } from '@/services/market';
import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { durationLabel, sameRarity, type SaleRecord } from './history';

export interface SaleRowProps {
  readonly record: SaleRecord;
  /** Rareté de l'exemplaire à vendre : une mise en vente dans une autre porte son badge. */
  readonly rarity: Rarity | undefined;
  readonly shiny: boolean;
  readonly disabled?: boolean;
  readonly onReuse: (record: SaleRecord) => void;
  /** Après le lien vers l'enchère (retrait de l'historique). */
  readonly children?: ComponentChildren;
}

/** Une mise en vente : date, mise, durée ; un clic la reprend. Lien vers son enchère, ouverte dans un autre onglet. */
export function SaleRow({ record, rarity, shiny, disabled = false, onReuse, children }: SaleRowProps) {
  const { at, price, minutes, auctionId } = record;
  const other = record.rarity !== undefined && !sameRarity(record, rarity, shiny) ? record.rarity : undefined;
  return (
    <li class="wm-sale-history-item">
      <button
        type="button"
        class={cx(siteClass.listRow, 'wm-sale-history-row')}
        title="Reprendre cette mise et cette durée"
        disabled={disabled}
        onClick={() => onReuse(record)}
      >
        <span class="wm-sale-history-date">
          {shortDate(at)} {formatTime(at)}
        </span>
        <span class="wm-sale-muted">{ageText(at)}</span>
        <span class="wm-sale-history-gap" />
        {other && (
          <span
            class={siteClass.rarityBadge}
            style={rarityBadgeStyle(other)}
            title={`Mise en vente en ${RARITY_NAMES[other]}${record.shiny ? ' shiny' : ''}`}
          >
            {other}
            {record.shiny && '✦'}
          </span>
        )}
        <span class="wm-sale-history-price">
          <Icon name="coin" class="wm-sale-history-coin" />
          {formatNumber(price)}
        </span>
        <span class="wm-sale-history-duration">{minutes === undefined ? '?' : durationLabel(minutes)}</span>
      </button>
      {auctionId ? (
        <a
          class={buttonClass('round', { size: 'sm', fill: 'ghost' })}
          href={`/marketplace/${encodeURIComponent(auctionId)}`}
          target="_blank"
          rel="noopener"
          title="Voir l'enchère"
          aria-label="Voir l'enchère"
        >
          <Icon name="external" size={14} />
        </a>
      ) : (
        <span class="wm-sale-history-nolink" />
      )}
      {children}
    </li>
  );
}
