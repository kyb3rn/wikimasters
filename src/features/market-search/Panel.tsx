import type { ComponentChildren } from 'preact';
import { useRef, useState } from 'preact/hooks';
import { SITE_LIKE_CLASS } from '@/core/dom';
import { OWN_CARD_GRID } from '@/services/card-display';
import { RarityFilter, SEARCH_PLACEHOLDER, SearchButton, snugSearchButtonCss, WishlistToggle } from '@/services/list-search';
import { siteErrorText, supabaseUserId } from '@/site/api';
import { RARITIES, type Rarity } from '@/site/rarity';
import { buttonClass } from '@/ui/button';
import { CaseFilter, Listbox, LoadError, NumberField, Switch } from '@/ui/controls';
import { Icon } from '@/ui/icons';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { AuctionTile } from './AuctionTile';
import { searchAuctions, type Auction, type SearchContext } from './data';
import {
  DEFAULT_FILTERS,
  sameFilters,
  type AuctionCursor,
  type AuctionFilters,
  LIMIT,
  type AuctionSort,
  type BidCase,
  type ShinyCase,
} from './query';

/**
 * Ce qui survit au passage par une annonce (le module reste chargé tant que la page ne se recharge pas) ; les filtres
 * affichés sont aussi enregistrés (`saveFilters`), pour le prochain chargement.
 */
export interface PanelStore {
  filters: AuctionFilters;
  readonly saveFilters: (filters: AuctionFilters) => void;
  applied: AuctionFilters | undefined;
  auctions: readonly Auction[] | undefined;
  cursor: AuctionCursor | undefined;
  context: SearchContext;
}

/** Feuille du panneau, posée par la fonctionnalité. */
export const panelCss = (): string => `
.wm-msearch { display: flex; flex-direction: column; gap: 1rem; }
.wm-msearch-line { display: flex; flex-wrap: wrap; align-items: stretch; gap: 0.75rem; }
.wm-msearch-line > .wm-msearch-field { flex: 1 1 300px; min-width: 0; }
.wm-msearch-line > .wm-msearch-sort { flex: 0 1 14rem; min-width: 10rem; }
${snugSearchButtonCss('.wm-msearch-line')}
.wm-msearch-more { display: flex; flex-wrap: wrap; align-items: flex-end; gap: 1rem 1.5rem; }
.wm-msearch-group { display: flex; flex-direction: column; gap: 0.375rem; }
.wm-msearch-range { display: flex; align-items: center; gap: 0.375rem; }
.wm-msearch-range > input { width: 6.5rem; height: ${tokens.fieldHeight}; }
.wm-msearch-unit { font-size: 0.75rem; opacity: 0.5; }
.wm-msearch-switch { display: flex; align-items: center; gap: 0.5rem; font-size: 0.875rem; height: ${tokens.fieldHeight}; }
.wm-msearch-status { font-size: 0.8125rem; opacity: 0.6; }
.wm-msearch-more-button { align-self: center; }
.wm-msearch-limit > span { height: ${tokens.fieldHeight}; }
`;

const SORT_OPTIONS: readonly { value: AuctionSort; label: string }[] = [
  { value: 'ending_soon', label: 'Fin imminente' },
  { value: 'ending_late', label: 'Fin la plus lointaine' },
  { value: 'recent', label: 'Récemment listées' },
];
// Aucune case ou toutes cochées : pas de filtre.
const BID_OPTIONS: readonly { value: BidCase; label: string }[] = [
  { value: 'with', label: 'Avec mise' },
  { value: 'without', label: 'Sans mise' },
];
const SHINY_OPTIONS: readonly { value: ShinyCase; label: string }[] = [
  { value: 'shiny', label: 'Shiny' },
  { value: 'normal', label: 'Normale' },
];

/** Case ajoutée ou retirée, dans l'ordre des options. */
const toggled = <T extends string>(options: readonly { value: T }[], checked: readonly T[], value: T): T[] =>
  options.map((option) => option.value).filter((v) => (v === value ? !checked.includes(v) : checked.includes(v)));

const parseBound = (text: string): number | undefined => {
  const value = Number(text.replace(/\s/g, '').replace(',', '.'));
  return text.trim() === '' || !Number.isFinite(value) || value < 0 ? undefined : Math.round(value);
};

type Bound = 'priceMin' | 'priceMax' | 'remainingMin' | 'remainingMax' | 'atkMin' | 'atkMax' | 'defMin' | 'defMax';

function Group(props: { readonly label: string; readonly children: ComponentChildren }) {
  return (
    <div class="wm-msearch-group">
      <span class={siteClass.fieldLabel}>{props.label}</span>
      {props.children}
    </div>
  );
}

export interface PanelProps {
  readonly store: PanelStore;
  readonly onOpen: (href: string) => void;
}

/** Requête en cours : une liste (nouvelle recherche, nouvel essai) ou sa suite. */
type Status = 'idle' | 'loading' | 'more';

/**
 * Recherche d'enchères actives lue directement dans Supabase (outil de dev) : champ, raretés, tri, puis prix,
 * temps restant, ATK, DEF, mises, shiny, sans mes ventes, liste de souhaits. La recherche ne part qu'à Entrée
 * ou au bouton, jamais d'elle-même, pas même à l'ouverture de l'onglet ; une requête à la fois. « Charger la
 * suite » reprend après la dernière annonce.
 */
export function Panel({ store, onOpen }: PanelProps) {
  const [filters, setFiltersState] = useState(store.filters);
  const [applied, setApplied] = useState(store.applied);
  const [auctions, setAuctions] = useState(store.auctions);
  const [cursor, setCursor] = useState(store.cursor);
  const [status, setStatus] = useState<Status>('idle');
  /** Dernière requête en échec : à la place de la liste, jusqu'à la prochaine réussie. */
  const [error, setError] = useState<string>();
  const [duration, setDuration] = useState<number>();
  const run = useRef(0);

  const setFilters = (next: AuctionFilters) => {
    store.filters = next;
    store.saveFilters(next);
    setFiltersState(next);
  };
  const patch = (change: Partial<AuctionFilters>) => setFilters({ ...filters, ...change });

  async function search(target: AuctionFilters, after: AuctionCursor | undefined): Promise<void> {
    const id = ++run.current;
    setStatus(after ? 'more' : 'loading');
    const started = performance.now();
    try {
      const page = await searchAuctions(target, after, store.context);
      if (id !== run.current) return;
      const list = after ? [...(auctions ?? []), ...page.auctions.filter((a) => !auctions?.some((b) => b.id === a.id))] : page.auctions;
      store.applied = target;
      store.auctions = list;
      store.cursor = page.cursor;
      setApplied(target);
      setAuctions(list);
      setCursor(page.cursor);
      setDuration(Math.round(performance.now() - started));
      setError(undefined);
    } catch (reason) {
      if (id !== run.current) return;
      setError(siteErrorText(reason));
    }
    setStatus('idle');
  }

  const busy = status === 'loading' || status === 'more';
  const launch = () => {
    if (!busy) void search(filters, undefined);
  };
  const onEnter = (event: KeyboardEvent) => {
    if (event.key === 'Enter') launch();
  };
  const toggleRarity = (rarity: Rarity) =>
    patch({ rarities: RARITIES.filter((r) => (r === rarity ? !filters.rarities.includes(r) : filters.rarities.includes(r))) });

  const range = (label: string, min: Bound, max: Bound, unit?: string) => (
    <Group label={label}>
      <span class="wm-msearch-range">
        {([min, max] as const).map((key, index) => (
          <input
            key={key}
            type="number"
            inputMode="numeric"
            min={0}
            class={siteClass.textField}
            placeholder={index === 0 ? 'min' : 'max'}
            aria-label={`${label} ${index === 0 ? 'minimum' : 'maximum'}`}
            value={filters[key] ?? ''}
            onInput={(event) => patch({ [key]: parseBound(event.currentTarget.value) })}
            onKeyDown={onEnter}
          />
        ))}
        {unit && <span class="wm-msearch-unit">{unit}</span>}
      </span>
    </Group>
  );

  const me = supabaseUserId();
  const searchStatus = status === 'loading' ? 'loading' : applied && sameFilters(filters, applied) ? 'reload' : 'search';

  return (
    <div class="wm-msearch">
      <div class="wm-msearch-line">
        <input
          type="search"
          class={`${siteClass.textField} wm-msearch-field`}
          placeholder={SEARCH_PLACEHOLDER}
          aria-label="Rechercher"
          value={filters.search}
          onInput={(event) => patch({ search: event.currentTarget.value })}
          onKeyDown={onEnter}
        />
        <RarityFilter rarities={RARITIES} checked={new Set(filters.rarities)} onToggle={toggleRarity} onReset={() => patch({ rarities: [] })} />
        <WishlistToggle active={filters.wishlistOnly} onClick={() => patch({ wishlistOnly: !filters.wishlistOnly })} />
        <Listbox
          ariaLabel="Tri"
          class="wm-msearch-sort"
          value={filters.sort}
          options={SORT_OPTIONS}
          onChange={(value) => patch({ sort: SORT_OPTIONS.find((option) => option.value === value)?.value ?? 'ending_soon' })}
        />
        <SearchButton status={searchStatus} disabled={status === 'more'} onClick={launch} name="wm-msearch-submit" />
      </div>

      <div class="wm-msearch-more">
        {range('Temps restant', 'remainingMin', 'remainingMax', 'min')}
        {range('Prix', 'priceMin', 'priceMax', 'wb')}
        {range('ATK', 'atkMin', 'atkMax')}
        {range('DEF', 'defMin', 'defMax')}
        <Group label="Mises">
          <CaseFilter
            label="Mises"
            options={BID_OPTIONS}
            checked={new Set(filters.bids)}
            onToggle={(value) => patch({ bids: toggled(BID_OPTIONS, filters.bids, value) })}
            onReset={() => patch({ bids: [] })}
          />
        </Group>
        <Group label="Shiny">
          <CaseFilter
            label="Shiny"
            options={SHINY_OPTIONS}
            checked={new Set(filters.shiny)}
            onToggle={(value) => patch({ shiny: toggled(SHINY_OPTIONS, filters.shiny, value) })}
            onReset={() => patch({ shiny: [] })}
          />
        </Group>
        <Group label="Par requête">
          <span class="wm-msearch-limit">
            <NumberField
              label="Enchères par requête"
              value={filters.limit}
              min={LIMIT.min}
              max={LIMIT.max}
              step={LIMIT.step}
              onChange={(limit) => patch({ limit })}
            />
          </span>
        </Group>
        <label class="wm-msearch-switch">
          <Switch label="Sans mes ventes" checked={filters.excludeMine} onChange={(excludeMine) => patch({ excludeMine })} />
          Sans mes ventes
        </label>
        {!sameFilters(filters, DEFAULT_FILTERS) && (
          <button
            type="button"
            class={buttonClass('square')}
            aria-label="Réinitialiser les filtres"
            title="Réinitialiser les filtres"
            onClick={() => setFilters(DEFAULT_FILTERS)}
          >
            <Icon name="undo" size={18} />
          </button>
        )}
      </div>

      {error !== undefined ? (
        <LoadError message={error} busy={status === 'loading'} onRetry={() => void search(applied ?? filters, undefined)} />
      ) : auctions === undefined ? null : auctions.length === 0 ? (
        <div class={siteClass.emptyFrame}>
          <Icon name="gavel" size={32} class={siteClass.emptyIcon} />
          <p class={siteClass.emptyText}>Aucune enchère ne correspond à ces filtres.</p>
        </div>
      ) : (
        <>
          <p class="wm-msearch-status">
            {auctions.length} enchère{auctions.length > 1 ? 's' : ''}
            {cursor ? ' · suite disponible' : ''}
            {duration === undefined ? '' : ` · ${duration} ms`}
          </p>
          <div class={`${siteClass.tileGrid} ${OWN_CARD_GRID} ${SITE_LIKE_CLASS}`}>
            {auctions.map((auction) => (
              <AuctionTile key={auction.id} auction={auction} leading={!!me && auction.currentBidderId === me} onOpen={onOpen} />
            ))}
          </div>
          {cursor && applied && (
            <button
              type="button"
              class={`${buttonClass('standard')} wm-msearch-more-button`}
              disabled={busy}
              aria-busy={status === 'more'}
              onClick={() => void search(applied, cursor)}
            >
              {status === 'more' && <Icon name="spinner" size={16} />}
              Charger la suite
            </button>
          )}
        </>
      )}
    </div>
  );
}
