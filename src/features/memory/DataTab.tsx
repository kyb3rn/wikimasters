import { useLayoutEffect, useRef, useState } from 'preact/hooks';
import type { DataItem, DataSet } from '@/core/data';
import { useConfirmStep, type ConfirmStep } from '@/services/site-confirm';
import { buttonClass } from '@/ui/button';
import { Pagination } from '@/ui/controls';
import { Icon } from '@/ui/icons';
import { openConfirm } from '@/ui/modal';
import { itemsLabel, NO_FILTERS, PAGE_SIZE, resultsLabel, sameFilters, selectItems, sortOptions, type ItemSort, type SalesFilters } from './list';
import type { DataLists, ListState } from './lists';
import { ListTools } from './ListTools';
import { Row } from './Row';

export interface DataTabProps {
  readonly sets: readonly DataSet[];
  readonly lists: DataLists;
  readonly signal: AbortSignal;
  readonly onExport: (sets: readonly DataSet[]) => Promise<void>;
}

/** Un onglet : une section par donnée, puis les valeurs uniques (filtres…) en lignes, sous la même liste. */
export function DataTab({ sets, lists, signal, onExport }: DataTabProps) {
  const step = useConfirmStep<string>();
  const singles = sets.filter((set) => set.single);
  return (
    <>
      {sets
        .filter((set) => !set.single)
        .map((set) => (
          <DataSection key={set.id} set={set} state={lists.state(set.id)} reload={() => lists.reload([set])} signal={signal} onExport={onExport} />
        ))}
      {singles.length > 0 && (
        <section class="wm-memory-section">
          <ul class="wm-memory-list">
            {singles.map((set) => (
              <SingleRow key={set.id} set={set} state={lists.state(set.id)} step={step} reload={() => lists.reload([set])} />
            ))}
          </ul>
        </section>
      )}
    </>
  );
}

/** Une valeur unique : son nom, ce qu'elle retient, « Rien de retenu » sinon. */
function SingleRow({ set, state, step, reload }: { set: DataSet; state: ListState; step: ConfirmStep<string>; reload: () => Promise<void> }) {
  const item = state.items?.[0];
  const remove = set.remove;
  const shown: DataItem = item ? { ...item, title: set.name } : { key: set.id, title: set.name, details: [state.loading ? '…' : 'Rien de retenu'], bytes: 0 };
  return (
    <Row
      item={shown}
      step={step}
      onDelete={
        item && remove
          ? async () => {
              await remove([item.key]);
              await reload();
            }
          : undefined
      }
    />
  );
}

interface SectionProps {
  readonly set: DataSet;
  readonly state: ListState;
  readonly reload: () => Promise<void>;
  readonly signal: AbortSignal;
  readonly onExport: (sets: readonly DataSet[]) => Promise<void>;
}

/** Une donnée : titre, ce qu'elle est, Exporter et Tout supprimer ; longue : recherche, tri, sélection, pages. */
function DataSection({ set, state, reload, signal, onExport }: SectionProps) {
  const step = useConfirmStep<string>();
  const items = state.items ?? [];
  const large = set.large === true;
  const remove = set.remove;
  const [draft, setDraft] = useState('');
  const [search, setSearch] = useState('');
  const [draftFilters, setDraftFilters] = useState<SalesFilters>(NO_FILTERS);
  const [filters, setFilters] = useState<SalesFilters>(NO_FILTERS);
  const [sort, setSort] = useState<ItemSort>('date');
  const [page, setPage] = useState(1);
  const [chosen, setChosen] = useState<ReadonlySet<string>>(new Set());
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set());
  const [exporting, setExporting] = useState(false);

  const shown = selectItems(items, large ? search : '', large ? sort : 'date', large && set.salesFilters ? filters : NO_FILTERS);
  const pages = Math.max(1, Math.ceil(shown.length / PAGE_SIZE));
  const current = Math.min(page, pages);
  const visible = large ? shown.slice((current - 1) * PAGE_SIZE, current * PAGE_SIZE) : shown;
  // Sélection : seulement ce qui est encore là et que la recherche et les filtres montrent.
  const selected = shown.filter((item) => chosen.has(item.key)).map((item) => item.key);
  const selectable = large && remove !== undefined;
  const nested = items.some((item) => item.children && item.children.length > 0);

  const pending = draft !== search || !sameFilters(draftFilters, filters);
  const launch = () => {
    if (pending) {
      setSearch(draft);
      setFilters(draftFilters);
      setPage(1);
    } else void reload();
  };
  const resettable = search !== '' || draft !== '' || !sameFilters(filters, NO_FILTERS) || !sameFilters(draftFilters, NO_FILTERS);
  const reset = () => {
    setDraft('');
    setSearch('');
    setDraftFilters(NO_FILTERS);
    setFilters(NO_FILTERS);
    setPage(1);
  };
  const toggle = (keys: readonly string[], on: boolean) =>
    setChosen((current) => {
      const next = new Set(current);
      for (const key of keys) {
        if (on) next.add(key);
        else next.delete(key);
      }
      return next;
    });
  const confirmRemoval = (keys: readonly string[], title: string, label: string) => {
    if (!remove) return;
    openConfirm({
      title,
      message: `${itemsLabel(keys.length)} de « ${set.name} » ${keys.length > 1 ? 'seront supprimés' : 'sera supprimé'}.`,
      confirmLabel: label,
      signal,
      onConfirm: async () => {
        await remove(keys);
        toggle(keys, false);
        await reload();
      },
    });
  };
  const deleteOne = (key: string) => async () => {
    await remove?.([key]);
    await reload();
  };

  return (
    <section class="wm-memory-section" data-set={set.id}>
      <header class="wm-memory-head">
        <div>
          <h3 class="wm-memory-heading">{set.name}</h3>
          <p class="wm-memory-text">{set.description}</p>
        </div>
        <div class="wm-memory-head-actions">
          {set.transfer && (
            <button
              type="button"
              class={buttonClass('standard', { size: 'sm' })}
              disabled={exporting || items.length === 0}
              aria-busy={exporting}
              title={`Enregistrer « ${set.name} » dans un fichier`}
              onClick={() => {
                setExporting(true);
                void onExport([set]).finally(() => setExporting(false));
              }}
            >
              <Icon name="download" size={14} busy={exporting} />
              Exporter
            </button>
          )}
          {set.clear && (
            <button
              type="button"
              class={buttonClass('standard', { size: 'sm', tone: 'danger', fill: 'ghost' })}
              disabled={items.length === 0}
              onClick={() => {
                const clear = set.clear;
                if (!clear) return;
                openConfirm({
                  title: 'Tout supprimer ?',
                  message: `Tout « ${set.name} » sera supprimé (${itemsLabel(items.length)}).`,
                  confirmLabel: 'Tout supprimer',
                  signal,
                  onConfirm: async () => {
                    await clear();
                    setChosen(new Set());
                    await reload();
                  },
                });
              }}
            >
              <Icon name="trash" size={14} />
              Tout supprimer
            </button>
          )}
        </div>
      </header>

      {large && (
        <ListTools
          name={set.name}
          search={draft}
          onSearch={setDraft}
          filters={set.salesFilters ? draftFilters : undefined}
          onFilters={setDraftFilters}
          sort={sort}
          sortOptions={sortOptions(items)}
          onSort={(value) => {
            setSort(value);
            setPage(1);
          }}
          status={state.loading ? 'loading' : pending ? 'search' : 'reload'}
          onLaunch={launch}
          onReset={set.salesFilters && resettable ? reset : undefined}
        />
      )}

      {large && state.items !== undefined && (
        <div class="wm-memory-results">
          <span>{resultsLabel(shown.length, items.length)}</span>
          {pages > 1 && <Pagination page={current} total={pages} delay={0} onChange={setPage} />}
        </div>
      )}

      {selectable && selected.length > 0 && (
        <div class="wm-memory-selection">
          <span>{itemsLabel(selected.length)} choisi{selected.length > 1 ? 's' : ''}</span>
          <button
            type="button"
            class={buttonClass('standard', { size: 'sm', tone: 'danger', fill: 'solid' })}
            onClick={() => confirmRemoval(selected, 'Supprimer la sélection ?', 'Supprimer')}
          >
            Supprimer la sélection
          </button>
          <button type="button" class={buttonClass('standard', { size: 'sm', fill: 'ghost' })} onClick={() => setChosen(new Set())}>
            Tout décocher
          </button>
        </div>
      )}

      <ul class="wm-memory-list" aria-busy={state.loading}>
        {selectable && shown.length > 0 && (
          <HeadRow shown={shown} chosen={chosen} nested={nested} onToggle={(on) => toggle(shown.map((item) => item.key), on)} />
        )}
        {state.items === undefined ? (
          <li class="wm-memory-empty">{state.failed ? 'Lecture impossible.' : 'Lecture…'}</li>
        ) : shown.length === 0 ? (
          <li class="wm-memory-empty">{items.length === 0 ? 'Rien de gardé.' : 'Aucun élément trouvé.'}</li>
        ) : (
          visible.flatMap((item) => {
            const open = expanded.has(item.key);
            const openItem = set.open;
            return [
              <Row
                key={item.key}
                item={item}
                step={step}
                {...(selectable && { selected: chosen.has(item.key), onSelect: (on: boolean) => toggle([item.key], on) })}
                {...(nested && {
                  expanded: open,
                  onExpand: () =>
                    setExpanded((current) => {
                      const next = new Set(current);
                      if (open) next.delete(item.key);
                      else next.add(item.key);
                      return next;
                    }),
                })}
                {...(openItem && { onOpen: () => openItem(item.key) })}
                {...(remove && { onDelete: deleteOne(item.key) })}
              />,
              ...(open
                ? (item.children ?? []).map((entry) => (
                    <Row key={entry.key} item={entry} step={step} child {...(remove && { onDelete: deleteOne(entry.key) })} />
                  ))
                : []),
            ];
          })
        )}
      </ul>
      {large && pages > 1 && (
        <div class="wm-memory-pages">
          <Pagination page={current} total={pages} delay={0} onChange={setPage} />
        </div>
      )}
    </section>
  );
}

/** En-tête d'une longue liste : case qui coche tout ce que la recherche montre (toutes pages), noms des colonnes. */
function HeadRow({ shown, chosen, nested, onToggle }: { shown: readonly DataItem[]; chosen: ReadonlySet<string>; nested: boolean; onToggle: (on: boolean) => void }) {
  const box = useRef<HTMLInputElement>(null);
  const count = shown.filter((item) => chosen.has(item.key)).length;
  const all = count === shown.length;
  useLayoutEffect(() => {
    if (box.current) box.current.indeterminate = count > 0 && !all;
  }, [count, all]);
  return (
    <li class="wm-memory-row" data-head="">
      <input
        ref={box}
        type="checkbox"
        class="wm-memory-check"
        checked={all}
        aria-label="Tout choisir"
        title="Tout choisir (toutes les pages)"
        onChange={(event) => onToggle(event.currentTarget.checked)}
      />
      {nested && <span class="wm-memory-spacer" />}
      <span class="wm-memory-main">Nom</span>
      <span class="wm-memory-date">Date</span>
      <span class="wm-memory-size">Taille</span>
      <span class="wm-memory-actions" />
    </li>
  );
}
