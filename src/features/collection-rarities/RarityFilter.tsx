import { RARITY_NAMES, rarityColor, type Rarity } from '@/site/rarity';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';

export interface RarityFilterProps {
  /** Raretés proposées par le site, dans son ordre. */
  readonly rarities: readonly Rarity[];
  readonly checked: ReadonlySet<Rarity>;
  readonly onToggle: (rarity: Rarity) => void;
  /** Décoche tout (« Réinitialiser rareté » du site). */
  readonly onReset: () => void;
}

/**
 * Une case par rareté, collées, puis une croix qui décoche tout ; les couleurs des raretés (cochée, survol)
 * viennent du style de la fonctionnalité (`wm-rarity`).
 */
export function RarityFilter({ rarities, checked, onToggle, onReset }: RarityFilterProps) {
  return (
    <div class={`${siteClass.fieldSegmented} wm-rarity-filter`} style={{ height: tokens.fieldHeight }} role="group" aria-label="Raretés">
      {rarities.map((rarity, index) => (
        <button
          key={rarity}
          type="button"
          class={[siteClass.fieldSegment, index > 0 && siteClass.segmentSeparator, 'wm-rarity'].filter(Boolean).join(' ')}
          style={{ '--wm-rarity': rarityColor(rarity) }}
          aria-pressed={checked.has(rarity)}
          title={RARITY_NAMES[rarity]}
          onClick={() => onToggle(rarity)}
        >
          {rarity}
        </button>
      ))}
      <button
        type="button"
        class={`${siteClass.fieldSegment} ${siteClass.segmentSeparator} ${siteClass.fieldSegmentIdle} disabled:opacity-40`}
        disabled={checked.size === 0}
        aria-label="Décocher toutes les raretés"
        title="Décocher toutes les raretés"
        onClick={onReset}
      >
        <Icon name="close" size={16} />
      </button>
    </div>
  );
}
