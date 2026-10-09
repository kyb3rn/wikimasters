import { tagChipStyle } from '@/site/collection';
import { Listbox, SortControl } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { siteClass } from '@/ui/site';
import {
  familyOptions,
  ORDER_LABELS,
  parseFamily,
  parseTagSort,
  parseTagUse,
  SORT_OPTIONS,
  SORT_ORDER,
  USE_OPTIONS,
  type TagFilters,
  type TagItem,
} from './filters';

const SEARCH = 'Rechercher une étiquette';

export interface TagFiltersBarProps {
  readonly filters: TagFilters;
  /** Étiquettes affichées par le site : familles de couleurs proposées. */
  readonly tags: readonly TagItem[];
  readonly onChange: (filters: TagFilters) => void;
}

/** Recherche (pendant la frappe), cartes, couleur et tri, entre la création et la liste. */
export function TagFiltersBar({ filters, tags, onChange }: TagFiltersBarProps) {
  const set = (change: Partial<TagFilters>) => onChange({ ...filters, ...change });
  return (
    <div class="wm-tag-filters">
      <input
        type="text"
        class={siteClass.textField}
        placeholder={SEARCH}
        aria-label={SEARCH}
        value={filters.query}
        onInput={(event) => set({ query: event.currentTarget.value })}
      />
      <Listbox
        ariaLabel="Filtrer par nombre de cartes"
        class="wm-tag-filter"
        value={filters.use}
        options={USE_OPTIONS}
        onChange={(value) => set({ use: parseTagUse(value) })}
      />
      <Listbox
        ariaLabel="Filtrer par couleur"
        class="wm-tag-filter"
        value={filters.family}
        options={familyOptions(tags, filters.family, tagChipStyle)}
        onChange={(value) => set({ family: parseFamily(value) })}
      />
      <SortControl
        ariaLabel="Trier les étiquettes"
        class="wm-tag-sort"
        value={filters.sort}
        options={SORT_OPTIONS}
        order={filters.order}
        orderLabel={ORDER_LABELS[filters.sort][filters.order]}
        onChange={(value) => {
          const sort = parseTagSort(value);
          // Un autre tri part dans son sens habituel.
          if (sort && sort !== filters.sort) set({ sort, order: SORT_ORDER[sort] });
        }}
        onOrderChange={(order) => set({ order })}
      />
    </div>
  );
}

export function NoTagMatch() {
  return <p class={cx(siteClass.emptyText, 'wm-tag-empty')}>Aucune étiquette ne correspond.</p>;
}
