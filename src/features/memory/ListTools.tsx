import { RarityFilter, SearchButton, type SearchStatus } from '@/services/list-search';
import { RARITIES } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { FieldGroup, Listbox, type ListboxOption, RangeField } from '@/ui/controls';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import type { ItemSort, SalesFilters } from './list';

const LOADED: readonly ListboxOption[] = [
  { value: '0', label: 'Peu importe' },
  { value: 'stale', label: 'Au-delà de la durée du cache' },
  { value: '7', label: 'Il y a plus de 7 jours' },
  { value: '30', label: 'Il y a plus de 30 jours' },
  { value: '90', label: 'Il y a plus de 90 jours' },
];

const LAST_SALE: readonly ListboxOption[] = [
  { value: '0', label: 'Peu importe' },
  { value: '7', label: 'Il y a plus de 7 jours' },
  { value: '30', label: 'Il y a plus de 30 jours' },
  { value: '90', label: 'Il y a plus de 90 jours' },
];

export interface ListToolsProps {
  /** Nom de la donnée (libellés des champs). */
  readonly name: string;
  readonly search: string;
  readonly onSearch: (search: string) => void;
  /** Filtres des ventes saisis ; absents : la recherche par nom seule. */
  readonly filters: SalesFilters | undefined;
  readonly onFilters: (filters: SalesFilters) => void;
  readonly sort: ItemSort;
  readonly sortOptions: readonly ListboxOption[];
  readonly onSort: (sort: ItemSort) => void;
  readonly status: SearchStatus;
  /** Applique la recherche et les filtres saisis (loupe, Entrée), ou relit la liste. */
  readonly onLaunch: () => void;
  /** Remet la recherche et les filtres à zéro, aussitôt ; absent : rien à remettre. */
  readonly onReset: (() => void) | undefined;
}

/**
 * Recherche d'une longue liste, rangée comme la « Recherche avancée » du marché : nom, raretés, tri et loupe sur la
 * première ligne, le reste des filtres sous elle, puis la réinitialisation.
 */
export function ListTools({ name, search, onSearch, filters, onFilters, sort, sortOptions, onSort, status, onLaunch, onReset }: ListToolsProps) {
  const onEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') onLaunch();
  };
  const patch = (change: Partial<SalesFilters>) => {
    if (filters) onFilters({ ...filters, ...change });
  };
  return (
    <div class="wm-memory-tools">
      <div class="wm-memory-line">
        <input
          type="text"
          class={cx(siteClass.textField, 'wm-memory-search')}
          placeholder="Rechercher par nom…"
          aria-label={`Rechercher dans « ${name} »`}
          value={search}
          onInput={(event) => onSearch(event.currentTarget.value)}
          onKeyDown={onEnter}
        />
        {filters && (
          <RarityFilter
            rarities={RARITIES}
            checked={new Set(RARITIES.filter((rarity) => filters.rarities.includes(rarity)))}
            onToggle={(rarity) => patch({ rarities: RARITIES.filter((r) => (r === rarity ? !filters.rarities.includes(r) : filters.rarities.includes(r))) })}
            onReset={() => patch({ rarities: [] })}
          />
        )}
        <Listbox ariaLabel={`Trier « ${name} »`} class="wm-memory-sort" value={sort} options={sortOptions} onChange={(value) => onSort(value as ItemSort)} />
        <SearchButton status={status} onClick={onLaunch} name="wm-memory-submit" />
      </div>
      {filters && (
        <div class="wm-memory-more">
          <FieldGroup label="Prix médian">
            <RangeField label="Prix médian" unit="wb" min={filters.priceMin} max={filters.priceMax} onChange={(priceMin, priceMax) => patch({ priceMin, priceMax })} onEnter={onLaunch} />
          </FieldGroup>
          <FieldGroup label="Ventes">
            <RangeField label="Ventes" min={filters.countMin} max={filters.countMax} onChange={(countMin, countMax) => patch({ countMin, countMax })} onEnter={onLaunch} />
          </FieldGroup>
          <FieldGroup label="Chargée">
            <Listbox
              ariaLabel="Chargée"
              class="wm-memory-when"
              value={String(filters.loadedDays)}
              options={LOADED}
              onChange={(value) => patch({ loadedDays: value === 'stale' ? 'stale' : Number(value) })}
            />
          </FieldGroup>
          <FieldGroup label="Dernière vente">
            <Listbox ariaLabel="Dernière vente" class="wm-memory-when" value={String(filters.idleDays)} options={LAST_SALE} onChange={(value) => patch({ idleDays: Number(value) })} />
          </FieldGroup>
          {onReset && (
            <button type="button" class={buttonClass('square')} aria-label="Réinitialiser les filtres" title="Réinitialiser les filtres" onClick={onReset}>
              <Icon name="undo" size={18} />
            </button>
          )}
        </div>
      )}
    </div>
  );
}
