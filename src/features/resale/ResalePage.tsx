import type { ComponentChildren } from 'preact';
import { useEffect, useLayoutEffect, useMemo, useReducer, useRef, useState } from 'preact/hooks';
import { isPlainClick, SITE_LIKE_CLASS } from '@/core/dom';
import type { Logger } from '@/core/log';
import { onSettingsChange } from '@/core/settings';
import { OWN_CARD_GRID } from '@/services/card-display';
import { CardFace } from '@/services/card-face';
import { RarityFilter, SEARCH_PLACEHOLDER, SearchButton } from '@/services/list-search';
import { formatNumber, plural, trackPrices } from '@/services/market';
import { AuctionTime, ensureMarketTileStyle } from '@/services/market-tile';
import { onWishedPricesChange, setWishedPrice, wishedPrice, type WishedPriceCard } from '@/services/wished-price';
import { fetchMySales, fetchUntaggedCopies, type MarketListing, type OwnedCopy } from '@/site/api';
import type { CardRef } from '@/site/cards';
import { RARITIES, type Rarity } from '@/site/rarity';
import { navigateTo } from '@/site/router';
import { auctionPath } from '@/site/routes';
import { buttonClass } from '@/ui/button';
import { cx } from '@/ui/cx';
import { Icon } from '@/ui/icons';
import { CardRing, RING_COLORS } from '@/ui/ring';
import { Listbox, LoadError, Pagination } from '@/ui/controls';
import { siteClass } from '@/ui/site';
import { tokens } from '@/ui/theme';
import { STAMPS, stampFace } from '@/ui/stamp';
import { useCopyActions, type CopyStatus } from './actions';
import {
  pageCount,
  pageOf,
  sameFilters,
  savedFilters,
  selectCopies,
  DEFAULT_ORDER,
  ORDER_LABELS,
  SORT_OPTIONS,
  wishedTotal,
  type ResaleCard,
  type ResaleFilters,
} from './list';
import { useSectionRead, type SectionRead } from './read';
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
  head: 'wm-resale-section-head',
  sale: 'wm-resale-sale',
} as const;

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
 * arrivée et à chaque rechargement, chacune à part (l'échec de l'une n'empêche pas l'autre de s'afficher). Filtres comme la Collection, sur les deux ; la recherche porte sur ce qui est déjà lu. Le tri se calcule quand la recherche part
 * (chargement, Entrée, bouton) : un prix chargé ensuite change son bouton, pas l'ordre (rien ne bouge sous la souris).
 */
export function ResalePage({ signal, log }: ResalePageProps) {
  const [, bump] = useReducer((count: number) => count + 1, 0);
  const redraw = () => bump(undefined);
  const prices = useMemo(() => trackPrices({ signal, log, onChange: redraw }), [signal, log]);
  useEffect(() => onSettingsChange(redraw, { signal }), [signal]);
  useEffect(() => onWishedPricesChange(redraw, { signal }), [signal]);

  const [draft, setDraft] = useState<ResaleFilters>(() => savedFilters.get());
  const [applied, setApplied] = useState<ResaleFilters>(draft);
  const [order, setOrder] = useState<readonly OwnedCopy[]>([]);
  const [saleOrder, setSaleOrder] = useState<readonly MarketListing[]>([]);
  const [page, setPage] = useState(1);
  const listTop = useRef<HTMLDivElement>(null);
  /** Carte dont la fenêtre du prix souhaité est ouverte. */
  const [editing, setEditing] = useState<ResaleCard>();

  const averageOf = (copy: ResaleCard) => prices.price(cardRef(copy))?.average;
  /** Prix de tri : souhaité, sinon moyenne des 7 dernières ventes de la rareté de l'exemplaire. */
  const priceOf = (copy: ResaleCard) => wishedOf(copy) ?? averageOf(copy);

  // Le tri par prix lit le cache des ventes : toutes les cartes d'une liste d'un coup, avant de la trier.
  const market = useSectionRead<MarketListing>({
    signal,
    log,
    name: 'Au marché',
    read: async () => {
      const listed = await fetchMySales();
      await prices.preload(listed.map((sale) => sale.cardId));
      return listed;
    },
    onRead: (list) => setSaleOrder(selectCopies(list, applied, priceOf)),
  });
  const collection = useSectionRead<OwnedCopy>({
    signal,
    log,
    name: 'Collection',
    read: async () => {
      const { copies: list, skipped } = await fetchUntaggedCopies();
      if (skipped > 0) log.warn(`${plural(skipped, 'exemplaire')} illisible(s), laissé(s) de côté`);
      await prices.preload(list.map((copy) => copy.cardId));
      return list;
    },
    onRead: (list) => {
      actions.reset();
      const ordered = selectCopies(list, applied, priceOf);
      setOrder(ordered);
      setPage((current) => Math.min(current, pageCount(ordered.length)));
    },
  });
  const sales = market.list;
  const copies = collection.list;
  const loading = market.loading || collection.loading;

  const actions = useCopyActions({ signal, log, copies: copies ?? [] });
  /** Encore à vendre : ni défaussée, ni mise aux enchères, ni étiquetée depuis la page. */
  const present = (copies ?? []).filter((copy) => actions.statusOf(copy) === undefined);

  function apply(target: ResaleFilters): void {
    savedFilters.set(target);
    setApplied(target);
    setOrder(selectCopies(copies ?? [], target, priceOf));
    setSaleOrder(selectCopies(sales ?? [], target, priceOf));
    setPage(1);
  }

  /** Les deux sections, en même temps (Supabase pour la collection, le site pour le marché). */
  const reload = () => {
    void market.load();
    void collection.load();
  };

  useEffect(() => {
    reload();
    // Une seule lecture à l'arrivée ; les suivantes au bouton.
  }, []);

  const hold = resaleSettings.get('holdSearch');
  const changed = !sameFilters(draft, applied);
  const edit = (next: ResaleFilters) => {
    setDraft(next);
    // Sans « Empêcher le rechargement automatique » : la liste suit chaque changement, frappe comprise.
    if (!hold) apply(next);
  };
  const launch = () => {
    if (loading) return;
    if (changed) apply(draft);
    else reload();
  };
  const toggleRarity = (rarity: Rarity) =>
    edit({ ...draft, rarities: RARITIES.filter((r) => (r === rarity ? !draft.rarities.includes(r) : draft.rarities.includes(r))) });

  // Rond de page jusqu'à la première réponse de chaque section, lue ou en échec.
  if ([market, collection].some((section) => section.list === undefined && section.error === undefined)) {
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
          {(sales || copies) && <Total cards={[...(sales ?? []), ...present]} />}
        </div>
      </div>

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

      <section class={RESALE_CLASS.section} data-section="market">
        <SectionHead title="Au marché" count={sales && saleOrder.length} read={market} />
        {market.error !== undefined ? (
          <LoadError message={market.error} busy={market.loading} onRetry={() => void market.load()} />
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

      <section class={RESALE_CLASS.section} data-section="collection">
        <SectionHead title="Collection" count={copies && order.length} read={collection} />
        {collection.error !== undefined ? (
          <LoadError message={collection.error} busy={collection.loading} onRetry={() => void collection.load()} />
        ) : copies?.length === 0 || order.length === 0 ? (
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
 * Case d'une carte : sa face (clic : la modale de carte du site, sauf défaussée ; en vente, elle s'ouvre toujours,
 * demande de l'utilisateur), puis ses prix. Après une action, la carte reste en place, tamponnée.
 */
function ResaleCell(props: { readonly copy: OwnedCopy; readonly status: CopyStatus | undefined; readonly onOpen: () => void; readonly children: ComponentChildren }) {
  const { copy, status, onOpen, children } = props;
  const cell = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const face = cell.current?.firstElementChild;
    if (face instanceof HTMLElement) stampFace(face, STAMP_OWNER, status && stampOf(status));
  }, [status]);
  return (
    <div ref={cell} class={siteClass.cardCell} data-copy={copy.id} data-status={status}>
      <CardFace card={copy} onClick={status === 'discarded' ? undefined : onOpen} />
      {children}
    </div>
  );
}

/**
 * Titre d'une section, son nombre de cartes une fois lue ; quand sa dernière lecture a échoué et que la liste d'avant
 * reste affichée, « Réessayer » à côté ne relit qu'elle (demande de l'utilisateur, 12/10).
 */
function SectionHead({ title, count, read }: { readonly title: string; readonly count: number | undefined; readonly read: SectionRead<unknown> }) {
  return (
    <div class={RESALE_CLASS.head}>
      <h2 class={siteClass.sectionTitle}>{count === undefined ? title : `${title} (${count})`}</h2>
      {read.stale && (
        <button
          type="button"
          class={buttonClass('standard', { tone: 'warning', size: 'sm' })}
          disabled={read.loading}
          aria-busy={read.loading}
          title="Lecture en échec : la liste affichée est l'ancienne."
          onClick={() => void read.load()}
        >
          <Icon name="reload" busy={read.loading} size={14} />
          Réessayer
        </button>
      )}
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
 * navigateur), sa mise et son temps restant comme les vignettes du marché, puis ses prix. Une mise reçue : cadre vert
 * autour de la face et « Mise actuelle » en vert (demande de l'utilisateur).
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
        {sale.hasBid && <CardRing color={RING_COLORS.green} />}
      </a>
      <div class={siteClass.tileInfo}>
        <div class={siteClass.tilePrice}>
          <span class={siteClass.tileLabel} style={sale.hasBid ? { color: RING_COLORS.green } : undefined}>
            {sale.hasBid ? 'Mise actuelle' : 'Mise de départ'}
          </span>
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
