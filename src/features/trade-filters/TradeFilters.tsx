import { RarityFilter, WishlistToggle } from '@/services/list-search';
import { tagChipStyle } from '@/site/collection';
import { RARITIES, type Rarity } from '@/site/rarity';
import type { TradeFilter } from '@/site/trades';
import { Listbox } from '@/ui/controls';

export interface TradeFiltersProps {
  /** Raretés cochées ; `undefined` : liste du site illisible, pas de cases. */
  readonly rarities: ReadonlySet<Rarity> | undefined;
  readonly onRarities: (next: ReadonlySet<Rarity>) => void;
  /** Filtre du site (étiquettes, liste de souhaits) ; `undefined` : illisible. */
  readonly filter: TradeFilter | undefined;
  readonly onTag: (id: string | null) => void;
  /** « Sans étiquette » choisie ; `undefined` : pas proposée (seulement « Mes cartes »). */
  readonly untagged: boolean | undefined;
  readonly onUntagged: () => void;
  readonly onWishlist: () => void;
  readonly tagsClass: string;
}

const UNTAGGED = '__untagged__';

/** Cases de rareté, liste des étiquettes et liste de souhaits, comme la Collection ; chaque contrôle appelle celui du site. */
export function TradeFilters({ rarities, onRarities, filter, onTag, untagged, onUntagged, onWishlist, tagsClass }: TradeFiltersProps) {
  return (
    <>
      {rarities && (
        <RarityFilter
          rarities={RARITIES}
          checked={rarities}
          onToggle={(rarity) => {
            const next = new Set(rarities);
            if (next.has(rarity)) next.delete(rarity);
            else next.add(rarity);
            onRarities(next);
          }}
          onReset={() => onRarities(new Set())}
        />
      )}
      {/* Là dès l'ouverture (la rangée ne bouge pas), remplie quand les étiquettes arrivent avec les cartes. */}
      {filter && (
        <Listbox
          ariaLabel="Filtrer par étiquette"
          class={tagsClass}
          value={untagged ? UNTAGGED : (filter.activeTagId ?? '')}
          options={[
            { value: '', label: 'Toutes les étiquettes' },
            ...(untagged === undefined ? [] : [{ value: UNTAGGED, label: 'Sans étiquette' }]),
            ...filter.tags.map((tag) => ({ value: tag.id, label: `#${tag.name} (${tag.cardCount})`, chipStyle: tagChipStyle(tag.color) })),
          ]}
          onChange={(value) => (value === UNTAGGED ? onUntagged() : onTag(value || null))}
        />
      )}
      {filter && (
        <WishlistToggle
          active={filter.wishlistActive}
          label={filter.wishlistLabel}
          title={filter.wishlistTitle || filter.wishlistLabel}
          onClick={onWishlist}
        />
      )}
    </>
  );
}
