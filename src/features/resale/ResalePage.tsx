import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { isPlainClick, SITE_LIKE_CLASS } from '@/core/dom';
import type { Logger } from '@/core/log';
import { onSettingsChange } from '@/core/settings';
import { jsonStore } from '@/core/storage';
import { OWN_CARD_GRID } from '@/services/card-display';
import { CardFace } from '@/services/card-face';
import { RarityFilter, SEARCH_PLACEHOLDER, SearchButton } from '@/services/list-search';
import { formatNumber, plural, trackPrices } from '@/services/market';
import { AuctionTime, ensureMarketTileStyle } from '@/services/market-tile';
import { onWishedPricesChange, setWishedPrice, wishedPrice, type WishedPriceCard } from '@/services/wished-price';
import { fetchMySales, fetchUntaggedCopies, siteErrorText, type MarketListing, type OwnedCopy } from '@/site/api';
import type { CardRef } from '@/site/cards';
import { RARITIES, type Rarity } from '@/site/rarity';
import { navigateTo } from '@/site/router';
import { auctionPath } from '@/site/routes';
import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { Listbox, LoadError, Pagination } from '@/ui/controls';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { STAMPS, stampFace } from '@/ui/stamp';
import { toast } from '@/ui/toast';
import { useCopyActions, type CopyStatus } from './actions';
import {
  DEFAULT_FILTERS,
  pageCount,
  pageOf,
  parseFilters,
  sameFilters,
  selectCopies,
  DEFAULT_ORDER,
  ORDER_LABELS,
  SORT_OPTIONS,
  wishedTotal,
  type ResaleCard,
  type ResaleFilters,
} from './list';
import { resaleSettings } from './settings';
import { WishedPriceButton } from './WishedPriceButton';
import { WishedPriceModal } from './WishedPriceModal';

/** Classes de la page (feuille posée par la fonctionnalité). */
export const RESALE_CLASS = {
  area: 'wm-resale-filter-area',
  line: 'wm-resale-filter-line',
  field: 'wm-resale-field',
  sort: 'wm-resale-sort',
  prices: 'wm-resale-prices',
  price: 'wm-resale-price',
  submit: 'wm-resale-submit',
  order: 'wm-resale-order',
  section: 'wm-resale-section',
  sale: 'wm-resale-sale',
} as const;

/** Filtres de la dernière recherche lancée (comme la Collection : tri, raretés, recherche ; pas la page). */
const savedFilters = /* @__PURE__ */ jsonStore('wm-resale-filters-v1', DEFAULT_FILTERS, parseFilters);

/** La carte d'un exemplaire pour le cache des ventes : ventes de sa rareté (celles d'une L shiny sont celles des L). */
const cardRef = (copy: ResaleCard): CardRef => ({ id: copy.cardId, title: copy.title, rarity: copy.rarity });
/** La carte d'un exemplaire pour son prix souhaité : rareté de l'exemplaire, L shiny à part. */
const wishedCard = (copy: ResaleCard): WishedPriceCard => ({ cardId: copy.cardId, title: copy.title, rarity: copy.rarity, shiny: copy.shiny });
const wishedOf = (copy: ResaleCard) => wishedPrice(wishedCard(copy))?.price;

export interface ResalePageProps {
  readonly signal: AbortSignal;
  readonly log: Logger;
}

/**
 * Page Revente : mes ventes en cours au marché (demande de l'utilisateur : elles m'appartiennent toujours et valent des
 * wikibidous ; 10 au plus, toutes affichées), puis les exemplaires sans étiquette, lus dans Supabase ; les deux à chaque
 * arrivée et à chaque rechargement. Filtres comme la Collection, sur les deux ; la recherche porte sur ce qui est déjà lu. Le tri se calcule quand la recherche part
 * (chargement, Entrée, bouton) : un prix chargé ensuite change son bouton, pas l'ordre (rien ne bouge sous la souris).
 */
export function ResalePage({ signal, log }: ResalePageProps) {
  const [, bump] = useReducer((count: number) => count + 1, 0);
  const redraw = () => bump(undefined);
  const prices = useMemo(() => trackPrices({ signal, log, onChange: redraw }), [signal, log]);
  useEffect(() => onSettingsChange(redraw, { signal }), [signal]);
  useEffect(() => onWishedPricesChange(redraw, { signal }), [signal]);

  /** Exemplaires lus ; jamais lus : `undefined`. */
  const [copies, setCopies] = useState<readonly OwnedCopy[]>();
  /** Première lecture en échec : à la place de la liste. */
  const [error, setError] = useState<string>();
  const [loading, setLoading] = useState(true);
  const [draft, setDraft] = useState<ResaleFilters>(() => savedFilters.get());
  const [applied, setApplied] = useState<ResaleFilters>(draft);
  const [order, setOrder] = useState<readonly OwnedCopy[]>([]);
  /** Mes ventes en cours ; jamais lues : `undefined`. */
  const [sales, setSales] = useState<readonly MarketListing[]>();
  /** Ventes pas lues : à la place de leur liste. */
  const [salesError, setSalesError] = useState<string>();
  const [saleOrder, setSaleOrder] = useState<readonly MarketListing[]>([]);
  const [page, setPage] = useState(1);
  const run = useRef(0);
  const listTop = useRef<HTMLDivElement>(null);
  /** Carte dont la fenêtre du prix souhaité est ouverte. */
  const [editing, setEditing] = useState<ResaleCard>();

  const actions = useCopyActions({ signal, log, copies: copies ?? [] });
  /** Encore à vendre : ni défaussée, ni mise aux enchères, ni étiquetée depuis la page. */
  const present = (copies ?? []).filter((copy) => actions.statusOf(copy) === undefined);

  const averageOf = (copy: ResaleCard) => prices.price(cardRef(copy))?.average;
  /** Prix de tri : souhaité, sinon moyenne des 7 dernières ventes de la rareté de l'exemplaire. */
  const priceOf = (copy: ResaleCard) => wishedOf(copy) ?? averageOf(copy);

  function apply(
    target: ResaleFilters,
    list: readonly OwnedCopy[] | undefined,
    listed: readonly MarketListing[] | undefined,
    keepPage: boolean,
  ): void {
    savedFilters.set(target);
    setApplied(target);
    const ordered = selectCopies(list ?? [], target, priceOf);
    setOrder(ordered);
    setSaleOrder(selectCopies(listed ?? [], target, priceOf));
    setPage((current) => (keepPage ? Math.min(current, pageCount(ordered.length)) : 1));
  }

  async function load(target: ResaleFilters, keepPage: boolean): Promise<void> {
    const id = ++run.current;
    setLoading(true);
    try {
      // Supabase pour la collection, le site pour le marché, en même temps.
      const [read, listed] = await Promise.allSettled([fetchUntaggedCopies(), fetchMySales()]);
      if (read.status === 'rejected') throw read.reason;
      const { copies: list, skipped } = read.value;
      const nextSales = listed.status === 'fulfilled' ? listed.value : sales;
      // Le tri par prix lit le cache des ventes : toutes les cartes d'un coup, avant de trier.
      await prices.preload([...list, ...(nextSales ?? [])].map((card) => card.cardId));
      if (id !== run.current || signal.aborted) return;
      if (skipped > 0) log.warn(`${plural(skipped, 'exemplaire')} illisible(s), laissé(s) de côté`);
      if (listed.status === 'rejected') {
        log.warn('ventes en cours non lues', listed.reason);
        // Une liste déjà là reste affichée.
        if (sales === undefined) setSalesError(siteErrorText(listed.reason));
        else toast.error(siteErrorText(listed.reason), { title: 'Ventes en cours' });
      } else {
        setSales(listed.value);
        setSalesError(undefined);
      }
      setCopies(list);
      actions.reset();
      setError(undefined);
      apply(target, list, nextSales, keepPage);
    } catch (reason) {
      if (id !== run.current || signal.aborted) return;
      log.warn('cartes à vendre non lues', reason);
      // Une liste déjà là reste affichée.
      if (copies === undefined) setError(siteErrorText(reason));
      else toast.error(siteErrorText(reason), { title: 'Revente' });
    } finally {
      if (id === run.current) setLoading(false);
    }
  }

  useEffect(() => {
    void load(draft, false);
    // Une seule lecture à l'arrivée ; les suivantes au bouton.
  }, []);

  const hold = resaleSettings.get('holdSearch');
  const changed = !sameFilters(draft, applied);
  const edit = (next: ResaleFilters) => {
    setDraft(next);
    // Sans « Empêcher le rechargement automatique » : la liste suit chaque changement, frappe comprise.
    if (!hold && copies) apply(next, copies, sales, false);
  };
  const launch = () => {
    if (loading) return;
    if (changed) apply(draft, copies, sales, false);
    else void load(applied, true);
  };
  const toggleRarity = (rarity: Rarity) =>
    edit({ ...draft, rarities: RARITIES.filter((r) => (r === rarity ? !draft.rarities.includes(r) : draft.rarities.includes(r))) });

  if (copies === undefined && error === undefined) {
    return (
      <div class={siteClass.pageSpinnerBox}>
        <div class={siteClass.pageSpinner} />
      </div>
    );
  }

  const pages = pageCount(order.length);
  const shown = pageOf(order, page);
  const goTo = (target: number) => {
    setPage(target);
    requestAnimationFrame(() => listTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }));
  };
  const pagination = pages > 1 && <Pagination page={page} total={pages} delay={0} onChange={goTo} />;

  return (
    <div class={siteClass.pageBody}>
      {/* À gauche seulement : le haut à droite est sous le cadre fixe du solde. */}
      <div class={siteClass.pageHeader}>
        <div class={siteClass.pageTitleGroup}>
          <h1 class={siteClass.pageTitle} style={{ fontFamily: tokens.heading }}>
            Revente
          </h1>
          {copies && <Total cards={[...(sales ?? []), ...present]} />}
        </div>
      </div>

      {error !== undefined ? (
        <LoadError message={error} busy={loading} onRetry={() => void load(applied, false)} />
      ) : (
        <>
          <div class={cx(siteClass.pageFilters, RESALE_CLASS.area)}>
            <div class={RESALE_CLASS.line}>
              <input
                type="text"
                class={cx(siteClass.textField, RESALE_CLASS.field)}
                placeholder={SEARCH_PLACEHOLDER}
                aria-label="Rechercher"
                value={draft.search}
                onInput={(event) => edit({ ...draft, search: event.currentTarget.value })}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') launch();
                }}
              />
              <RarityFilter rarities={RARITIES} checked={new Set(draft.rarities)} onToggle={toggleRarity} onReset={() => edit({ ...draft, rarities: [] })} />
              <Listbox
                ariaLabel="Trier les cartes"
                class={RESALE_CLASS.sort}
                value={draft.sort}
                options={SORT_OPTIONS}
                onChange={(value) => {
                  const sort = SORT_OPTIONS.find((option) => option.value === value)?.value ?? draft.sort;
                  // Un autre tri part dans son sens habituel.
                  if (sort !== draft.sort) edit({ ...draft, sort, order: DEFAULT_ORDER[sort] });
                }}
              />
              <OrderButton
                filters={draft}
                onToggle={() => edit({ ...draft, order: draft.order === 'asc' ? 'desc' : 'asc' })}
              />
              <SearchButton status={loading ? 'loading' : changed ? 'search' : 'reload'} onClick={launch} name={RESALE_CLASS.submit} />
            </div>
          </div>

          <section class={RESALE_CLASS.section}>
            <h2 class={siteClass.sectionTitle}>Au marché ({saleOrder.length})</h2>
            {salesError !== undefined ? (
              <LoadError message={salesError} busy={loading} onRetry={() => void load(applied, true)} />
            ) : saleOrder.length === 0 ? (
              <p class={siteClass.pageNote}>{sales?.length ? 'Aucune carte en vente avec ces filtres.' : 'Aucune carte en vente.'}</p>
            ) : (
              <div class={cx(siteClass.cardGrid, OWN_CARD_GRID, SITE_LIKE_CLASS)}>
                {saleOrder.map((sale) => (
                  <SaleCell key={sale.id} sale={sale}>
                    <Prices card={sale} button={prices.button(cardRef(sale))} onEdit={() => setEditing(sale)} />
                  </SaleCell>
                ))}
              </div>
            )}
          </section>

          <section class={RESALE_CLASS.section}>
            <h2 class={siteClass.sectionTitle}>Collection ({order.length})</h2>
          {copies?.length === 0 || order.length === 0 ? (
            <div class={siteClass.emptyFrame}>
              <Icon name="coins" size={32} class={siteClass.emptyIcon} />
              <p class={siteClass.emptyText}>{copies?.length === 0 ? 'Aucune carte sans étiquette.' : 'Aucune carte trouvée avec ces filtres.'}</p>
            </div>
          ) : (
            <div ref={listTop} class={siteClass.pageList}>
              {pagination}
              <div class={cx(siteClass.cardGrid, OWN_CARD_GRID, SITE_LIKE_CLASS)}>
                {shown.map((copy) => (
                  <ResaleCell key={copy.id} copy={copy} status={actions.statusOf(copy)} onOpen={() => actions.open(copy)}>
                    <Prices card={copy} button={prices.button(cardRef(copy))} onEdit={() => setEditing(copy)} />
                  </ResaleCell>
                ))}
              </div>
              {pagination}
            </div>
          )}
          </section>
        </>
      )}
      {editing && (
        <WishedPriceModal
          title={editing.title}
          rarity={editing.rarity}
          shiny={editing.shiny}
          current={wishedOf(editing)}
          average={averageOf(editing)}
          onSave={(price) => {
            setWishedPrice(wishedCard(editing), price);
            setEditing(undefined);
          }}
          onClose={() => setEditing(undefined)}
        />
      )}
    </div>
  );
}

/** Tampons de la page sur ses faces. */
const STAMP_OWNER = 'resale';
// Une fonction, pas une table : lire `STAMPS` au niveau du module le garderait dans le fichier de production.
function stampOf(status: CopyStatus) {
  if (status === 'discarded') return STAMPS.discarded;
  // Étiquetée : elle n'est plus à vendre, grisée sans texte.
  return status === 'listed' ? STAMPS.listed : STAMPS.greyed;
}

/**
 * Case d'une carte : sa face (clic : la modale de carte du site, sauf défaussée ou en vente), puis ses prix. Après
 * une action, la carte reste en place, tamponnée.
 */
function ResaleCell(props: { readonly copy: OwnedCopy; readonly status: CopyStatus | undefined; readonly onOpen: () => void; readonly children: ComponentChildren }) {
  const { copy, status, onOpen, children } = props;
  const cell = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const face = cell.current?.firstElementChild;
    if (face instanceof HTMLElement) stampFace(face, STAMP_OWNER, status && stampOf(status));
  }, [status]);
  const gone = status === 'discarded' || status === 'listed';
  return (
    <div ref={cell} class={siteClass.cardCell} data-copy={copy.id} data-status={status}>
      <CardFace card={copy} onClick={gone ? undefined : onOpen} />
      {children}
    </div>
  );
}

/** Sens du tri, à droite de la liste du tri (demande de l'utilisateur) : un clic l'inverse. */
function OrderButton({ filters, onToggle }: { readonly filters: ResaleFilters; readonly onToggle: () => void }) {
  const label = ORDER_LABELS[filters.sort][filters.order];
  return (
    <button
      type="button"
      class={cx(buttonClass('square'), RESALE_CLASS.order)}
      data-order={filters.order}
      aria-label={`Sens du tri : ${label}`}
      title={`${label}. Clic : inverser.`}
      onClick={onToggle}
    >
      <Icon name={filters.order === 'asc' ? 'sortAscending' : 'sortDescending'} size={18} />
    </button>
  );
}

/** Sous chaque carte : prix souhaité (mauve) à gauche, prix moyen (`trackPrices`) à droite. */
function Prices({ card, button, onEdit }: { readonly card: ResaleCard; readonly button: ComponentChildren; readonly onEdit: () => void }) {
  return (
    <div class={RESALE_CLASS.prices}>
      <WishedPriceButton price={wishedOf(card)} onClick={onEdit} />
      {button && <div class={RESALE_CLASS.price}>{button}</div>}
    </div>
  );
}

/**
 * Une de mes ventes en cours : sa face, lien vers l'enchère (navigation du site ; Ctrl, Maj, clic du milieu laissés au
 * navigateur), sa mise et son temps restant comme les vignettes du marché, puis ses prix.
 */
function SaleCell({ sale, children }: { readonly sale: MarketListing; readonly children: ComponentChildren }) {
  ensureMarketTileStyle();
  const href = auctionPath(sale.id);
  return (
    <div class={cx(siteClass.cardCell, RESALE_CLASS.sale)} data-sale={sale.id}>
      <a
        href={href}
        title="Voir l'enchère"
        onClick={(event) => {
          if (!isPlainClick(event)) return;
          event.preventDefault();
          navigateTo(href);
        }}
      >
        <CardFace card={sale} />
      </a>
      <div class={siteClass.tileInfo}>
        <div class={siteClass.tilePrice}>
          <span class={siteClass.tileLabel}>{sale.hasBid ? 'Mise actuelle' : 'Mise de départ'}</span>
          <span class={siteClass.tileAmount}>
            <Icon name="coin" class={siteClass.tileCoin} />
            {formatNumber(sale.amount)}
          </span>
        </div>
        <div class={siteClass.tileDuration}>
          <span class={siteClass.tileLabel}>
            <Icon name="gavel" class={siteClass.tileGavel} />
            Durée
          </span>
          <AuctionTime endAt={sale.endAt} />
        </div>
      </div>
      {children}
    </div>
  );
}

/**
 * Total des prix souhaités (demande de l'utilisateur : eux seuls, pas la valeur du marché) des cartes encore là
 * (ventes en cours comprises : elles valent des wikibidous), chacune comptée une fois (deux exemplaires de la même
 * carte dans la même rareté comptent deux fois), puis le nombre de cartes et celles sans prix souhaité.
 */
function Total({ cards }: { readonly cards: readonly ResaleCard[] }) {
  const { total, missing } = wishedTotal(cards, wishedOf);
  return (
    <>
      <span class={siteClass.pageTotal} title="Total des prix souhaités">
        <Icon name="coin" class={siteClass.pageTotalIcon} />
        {formatNumber(total)}
      </span>
      <span class={siteClass.pageNote}>
        {plural(cards.length, 'carte')} · {missing} sans prix souhaité
      </span>
    </>
  );
}
