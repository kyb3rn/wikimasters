import { RARITY_NAMES, rarityColor, type Rarity } from '@/site/rarity';
import { CaseFilter } from '@/ui/controls';

export interface RarityFilterProps {
  /** Raretés proposées par le site, dans son ordre. */
  readonly rarities: readonly Rarity[];
  readonly checked: ReadonlySet<Rarity>;
  readonly onToggle: (rarity: Rarity) => void;
  /** Décoche tout (« Réinitialiser rareté » du site). */
  readonly onReset: () => void;
}

/** Une case par rareté, de sa couleur, collées, puis une croix qui décoche tout. */
export function RarityFilter({ rarities, checked, onToggle, onReset }: RarityFilterProps) {
  return (
    <CaseFilter
      label="Raretés"
      class="wm-rarity-filter"
      caseClass="wm-rarity"
      resetLabel="Décocher toutes les raretés"
      options={rarities.map((rarity) => ({ value: rarity, label: rarity, title: RARITY_NAMES[rarity], color: rarityColor(rarity) }))}
      checked={checked}
      onToggle={onToggle}
      onReset={onReset}
    />
  );
}
