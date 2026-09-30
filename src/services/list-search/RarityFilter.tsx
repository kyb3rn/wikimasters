import { injectStyle } from '@/core/dom';
import { RARITY_NAMES, rarityColor, type Rarity } from '@/site/rarity';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';

/*
 * Case de rareté cochée : bordure intérieure et lettres de la couleur de la rareté (`--wm-rarity`, posée sur chaque case),
 * sans fond ; au survol, cochée ou non, fond de cette couleur, léger. La première reprend
 * l'arrondi du cadre (moins sa bordure), sinon il rognerait les coins de la bordure intérieure.
 */
const CSS = `
.wm-rarity-filter > .wm-rarity { color: color-mix(in srgb, ${tokens.foreground} 60%, transparent); background-color: transparent;
  transition: color 0.15s ease, background-color 0.15s ease, box-shadow 0.15s ease; }
.wm-rarity-filter > .wm-rarity:hover { color: ${tokens.foreground};
  background-color: color-mix(in srgb, var(--wm-rarity) 15%, transparent); }
.wm-rarity-filter > .wm-rarity[aria-pressed="true"] { color: var(--wm-rarity); box-shadow: inset 0 0 0 2px var(--wm-rarity); }
.wm-rarity-filter > .wm-rarity:first-child { border-radius: calc(var(--radius-lg, 0.5rem) - 1px) 0 0 calc(var(--radius-lg, 0.5rem) - 1px); }
`;

export interface RarityFilterProps {
  /** Raretés proposées par le site, dans son ordre. */
  readonly rarities: readonly Rarity[];
  readonly checked: ReadonlySet<Rarity>;
  readonly onToggle: (rarity: Rarity) => void;
  /** Décoche tout (« Réinitialiser rareté » du site). */
  readonly onReset: () => void;
}

/** Une case par rareté, collées, puis une croix qui décoche tout. */
export function RarityFilter({ rarities, checked, onToggle, onReset }: RarityFilterProps) {
  injectStyle('rarity-cases', CSS);
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
