import { isRecord, isSet } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { fiberOf, findPropsAbove, stateHooks } from '@/core/react';
import { textOf } from '@/core/text';
import { SITE_OVERLAY } from '@/site/modals';
import { findUnderlinedTabBars } from '@/site/tabs';

/*
 * Fenêtre « Échanger avec … » / « Contre-offre avec … » (code du site, 30/09/2026) : portail dans `body`, fond
 * `fixed inset-0 z-50`, cadre `max-w-5xl h-[90vh]`. En-tête (`h2`, pseudo de l'ami dans un `span`), résumé, onglets
 * « Mes cartes » / « Cartes de … » (seul le contenu de l'onglet choisi est rendu, clé React `tab-mine` / `tab-theirs`),
 * puis la zone qui défile : « Sélectionnées (n) » s'il y en a, les filtres (`div.mb-4.flex.flex-col.gap-3`), la zone
 * des cartes (`div.relative.min-h-[200px]` : roue en voile pendant un chargement, grille, pagination ← n / m →,
 * ou texte « Aucune carte… »).
 *
 * Filtres : rangée `div.flex.flex-col.gap-3.sm:flex-row` avec le champ « Rechercher... » (filtre local de la page
 * chargée, puis requête 300 ms après la frappe, 3 caractères au moins) et, à droite, un groupe `div.order-1` :
 * « Ajouter des WB » (composant `{ value, onExpand }` ; montant en badge s'il y en a), « Rareté » (liste à
 * plusieurs choix, `{ filter: Set, onChange }`), « Filtre » (`{ tags, activeTagId, onSelect, wishlistLabel,
 * wishlistTitle, wishlistActive, onWishlistToggle }` : liste de souhaits et étiquettes). Un clic sur « Ajouter
 * des WB » retire le bouton et ouvre, sous la rangée, un champ `{ label, value, onChange, onClose, balanceHint,
 * maxBalance }` (« Enregistrer » : `onChange(montant)` puis `onClose()` ; pas d'annulation). Sous la rangée aussi :
 * texte ambre sous 3 caractères, erreur de chargement (`p[role=status]` rouge).
 *
 * Chargement de chaque côté (les deux à l'ouverture, puis à chaque changement de page ou de filtre, dans un effet) :
 * « Mes cartes » `GET /api/my-collection?…&owned_by=<ami>`, « Cartes de … » `GET /api/profile/<ami>/collection?…
 * &pending=1`. Réponse en erreur : grille vidée, message (504 : « La recherche a pris trop de temps… ») ; échec
 * réseau : rien (la grille garde l'ancienne liste). Aucune requête interrompue.
 */

export type TradeSide = 'mine' | 'theirs';

export interface TradeComposer {
  readonly root: HTMLElement;
  readonly frame: HTMLElement;
  /** Pseudo de l'ami. */
  readonly friend: string;
  /** Son pseudo dans le titre (« Échanger avec <span> »). */
  readonly friendName: HTMLElement;
  /** Résumé « Moi : n cartes · m wb ⇄ … », sous l'en-tête. */
  readonly summary: TradeSummary | undefined;
  /** Onglets « Mes cartes » / « Cartes de … » (rangée soulignée sous le résumé). */
  readonly tabs: TradeTabs | undefined;
  /** Contenu de l'onglet affiché, s'il est lisible. */
  readonly tab: TradeComposerTab | undefined;
}

export interface TradeComposerTab {
  readonly side: TradeSide;
  readonly content: HTMLElement;
  /** Bloc des filtres : rangée, puis textes et champ des wikibidous. */
  readonly filters: HTMLElement;
  readonly line: HTMLElement;
  readonly search: HTMLInputElement;
  /** Groupe du site à droite du champ : wikibidous, raretés, filtre. */
  readonly group: HTMLElement;
  readonly rarityButton: HTMLButtonElement | undefined;
  readonly filterButton: HTMLButtonElement | undefined;
  /** « Ajouter des WB » (absent tant que le champ des wikibidous est ouvert). */
  readonly wikibidousButton: HTMLButtonElement | undefined;
  /** Champ des wikibidous, ouvert sous la rangée. */
  readonly wikibidousEditor: HTMLElement | undefined;
  /** Message d'erreur du chargement. */
  readonly error: HTMLElement | undefined;
  /** Zone des cartes : voile de chargement, grille, pagination ou texte. */
  readonly cards: HTMLElement | undefined;
  /** Bloc « Sélectionnées (n) », au-dessus des filtres, s'il y en a : titre, grille, trait. */
  readonly selected: HTMLElement | undefined;
  /** Cases des cartes : choisies (bloc « Sélectionnées »), à choisir (zone des cartes). */
  readonly cells: readonly TradeCardCell[];
}

export interface TradeCardCell {
  readonly button: HTMLElement;
  readonly selected: boolean;
  /** Carte qu'on ne peut pas choisir (échange en attente, 100 cartes atteintes…). */
  readonly locked: boolean;
}

export interface TradeSummarySide {
  readonly name: string;
  readonly cards: number;
  readonly wikibidous: number;
}

export interface TradeTabs {
  readonly bar: HTMLElement;
  readonly mine: HTMLButtonElement;
  readonly theirs: HTMLButtonElement;
}

function readTabs(frame: HTMLElement): TradeTabs | undefined {
  const bar = findUnderlinedTabBars(frame).find((candidate) => candidate.parentElement === frame);
  const [mine, theirs, extra] = bar?.querySelectorAll<HTMLButtonElement>(':scope > button') ?? [];
  return bar && mine && theirs && !extra ? { bar, mine, theirs } : undefined;
}

export interface TradeSummary {
  readonly root: HTMLElement;
  readonly mine: TradeSummarySide;
  readonly theirs: TradeSummarySide;
}

/** Côté du résumé : « Moi : 2 cartes · 1 500 wb » (montant seulement s'il y en a). */
export function parseTradeSummarySide(text: string): TradeSummarySide | undefined {
  const match = /^(.+) : (\d+) cartes?(?: · ([\d\s]+) wb)?$/u.exec(text.trim());
  if (!match?.[1] || !match[2]) return undefined;
  return { name: match[1], cards: Number(match[2]), wikibidous: match[3] ? Number(match[3].replace(/\s/g, '')) : 0 };
}

function readSummary(frame: HTMLElement): TradeSummary | undefined {
  for (const root of frame.querySelectorAll<HTMLElement>(':scope > div.justify-center')) {
    const [first, second] = root.querySelectorAll(':scope > span');
    const mine = first && parseTradeSummarySide(textOf(first));
    const theirs = second && parseTradeSummarySide(textOf(second));
    if (mine && theirs) return { root, mine, theirs };
  }
  return undefined;
}

const cellsOf = (grid: Element | null | undefined, selected: boolean): TradeCardCell[] =>
  [...(grid?.querySelectorAll<HTMLElement>(':scope > button') ?? [])].map((button) => ({
    button,
    selected,
    locked: button.classList.contains('cursor-not-allowed'),
  }));

const FRAME = `${SITE_OVERLAY} > div.max-w-5xl`;
const TITLE = /^(Échanger|Contre-offre) avec/;

function readTab(content: HTMLElement): TradeComposerTab | undefined {
  const filters = content.querySelector<HTMLElement>(':scope > div.mb-4.flex-col');
  const line = filters?.querySelector<HTMLElement>(':scope > div.flex');
  const search = line?.querySelector<HTMLInputElement>(':scope > input');
  const group = line?.querySelector<HTMLElement>(':scope > div');
  if (!filters || !line || !search || !group) return undefined;
  const cards = content.querySelector<HTMLElement>(':scope > div.relative') ?? undefined;
  const selected = content.querySelector<HTMLElement>(':scope > div.mb-4:not(.flex-col)') ?? undefined;
  const [rarityButton, filterButton] = group.querySelectorAll<HTMLButtonElement>(':scope > div.relative > button[aria-haspopup="listbox"]');
  return {
    side: fiberOf(content)?.key === 'tab-theirs' ? 'theirs' : 'mine',
    content,
    filters,
    line,
    search,
    group,
    rarityButton,
    filterButton,
    wikibidousButton: group.querySelector<HTMLButtonElement>(':scope > button') ?? undefined,
    wikibidousEditor: filters.querySelector<HTMLElement>(':scope > div:has(input[type="number"])') ?? undefined,
    error: filters.querySelector<HTMLElement>(':scope > p[role="status"]') ?? undefined,
    cards,
    selected,
    cells: [...cellsOf(selected?.querySelector(':scope > div.grid'), true), ...cellsOf(cards?.querySelector(':scope > div.grid'), false)],
  };
}

/** Fenêtre de composition d'un échange, si elle est ouverte. */
export function findTradeComposer(doc: Document = document): TradeComposer | undefined {
  for (const frame of doc.querySelectorAll<HTMLElement>(FRAME)) {
    const title = frame.querySelector('h2');
    if (!title || !TITLE.test(textOf(title))) continue;
    const friendName = title.querySelector<HTMLElement>('span');
    const friend = friendName?.textContent?.trim();
    const root = frame.parentElement;
    if (!friendName || !friend || !root) continue;
    const content = frame.querySelector<HTMLElement>('div.overflow-y-auto > div');
    return { root, frame, friend, friendName, summary: readSummary(frame), tabs: readTabs(frame), tab: content ? readTab(content) : undefined };
  }
  return undefined;
}

/** Côté dont `request` charge les cartes, pour la fenêtre ouverte avec `friend`. */
export function tradeCardsSide(request: Pick<NetRequest, 'method' | 'url'>, friend: string): TradeSide | undefined {
  if (request.method !== 'GET') return undefined;
  const { pathname, searchParams } = request.url;
  if (pathname === '/api/my-collection') return searchParams.get('owned_by') === friend ? 'mine' : undefined;
  const profile = /^\/api\/profile\/([^/]+)\/collection$/.exec(pathname);
  if (!profile?.[1] || searchParams.get('pending') !== '1') return undefined;
  try {
    return decodeURIComponent(profile[1]) === friend ? 'theirs' : undefined;
  } catch {
    return undefined;
  }
}

/**
 * Compteurs de « Mes cartes » (`GET /api/my-collection/stats?sort=rarity[&filtres]`, sans `owned_by`, en page 1,
 * partis juste avant la liste) : le site y lit le total (pagination) et les étiquettes. Rien d'autre ne les
 * distingue de ceux de la Collection : à croiser avec la fenêtre ouverte.
 */
export function isTradeMineStats(request: Pick<NetRequest, 'method' | 'url'>): boolean {
  const { pathname, searchParams } = request.url;
  return request.method === 'GET' && pathname === '/api/my-collection/stats' && searchParams.get('sort') === 'rarity';
}

/** Paramètres que le site place avant l'étiquette (`appendMyCollectionFilterParams`). */
const BEFORE_TAG = new Set(['sort', 'q', 'rarity']);

/**
 * Liste ou compteurs de « Mes cartes » limités aux cartes sans étiquette, comme « Sans étiquette » de la Collection
 * (le site ne le propose pas ici, la route l'accepte, total des compteurs compris) : `untagged=1` à la place de
 * `tag_id`, dans l'ordre du site (tri, recherche, raretés, étiquette, liste de souhaits, puis page, `stats`, `owned_by`).
 */
export function withUntaggedFilter(url: URL): URL {
  const params = new URLSearchParams();
  let placed = false;
  for (const [key, value] of url.searchParams) {
    if (key === 'tag_id' || key === 'untagged') continue;
    if (!placed && !BEFORE_TAG.has(key)) {
      params.append('untagged', '1');
      placed = true;
    }
    params.append(key, value);
  }
  if (!placed) params.append('untagged', '1');
  const next = new URL(url.href);
  next.search = params.toString();
  return next;
}

export interface TradeRarities {
  readonly checked: ReadonlySet<string>;
  /** Ce que fait la liste du site (retour en page 1, rechargement). */
  choose(next: ReadonlySet<string>): void;
}

/** Liste des raretés du site : `{ filter: Set, onChange }`. */
const isRarityList = (props: Record<string, unknown>) => isSet(props.filter) && typeof props.onChange === 'function';

export function readTradeRarities(button: HTMLButtonElement): TradeRarities | undefined {
  const props = findPropsAbove(button, isRarityList)?.props;
  if (!props) return undefined;
  const onChange = props.onChange as (value: Set<string>) => void;
  const filter = props.filter as ReadonlySet<unknown>;
  return {
    checked: new Set([...filter].filter((value): value is string => typeof value === 'string')),
    choose: (next) => onChange(new Set(next)),
  };
}

export interface TradeTag {
  readonly id: string;
  readonly name: string;
  readonly color: string | undefined;
  readonly cardCount: number;
}

export interface TradeFilter {
  readonly tags: readonly TradeTag[];
  readonly activeTagId: string | null;
  selectTag(id: string | null): void;
  /** Libellé et explication de la liste de souhaits (« Souhaits de … », « Mes souhaits »). */
  readonly wishlistLabel: string;
  readonly wishlistTitle: string;
  readonly wishlistActive: boolean;
  toggleWishlist(active: boolean): void;
}

function parseTag(value: unknown): TradeTag[] {
  if (!isRecord(value) || typeof value.id !== 'string' || typeof value.name !== 'string') return [];
  return [
    {
      id: value.id,
      name: value.name,
      color: typeof value.color === 'string' ? value.color : undefined,
      cardCount: typeof value.cardCount === 'number' ? value.cardCount : 0,
    },
  ];
}

export function readTradeFilter(button: HTMLButtonElement): TradeFilter | undefined {
  const props = findPropsAbove(button, (p) => typeof p.onSelect === 'function' && typeof p.onWishlistToggle === 'function')?.props;
  if (!props) return undefined;
  const onSelect = props.onSelect as (id: string | null) => void;
  const onWishlistToggle = props.onWishlistToggle as (active: boolean) => void;
  return {
    tags: Array.isArray(props.tags) ? props.tags.flatMap(parseTag) : [],
    activeTagId: typeof props.activeTagId === 'string' ? props.activeTagId : null,
    selectTag: (id) => onSelect(id),
    wishlistLabel: typeof props.wishlistLabel === 'string' ? props.wishlistLabel : 'Liste de souhaits',
    wishlistTitle: typeof props.wishlistTitle === 'string' ? props.wishlistTitle : '',
    wishlistActive: props.wishlistActive === true,
    toggleWishlist: (active) => onWishlistToggle(active),
  };
}

/** Montant déjà mis dans l'échange, lu sur le bouton des wikibidous. */
export function readTradeWikibidousButton(button: HTMLButtonElement): { value: number; expand(): void } | undefined {
  const props = findPropsAbove(button, (p) => typeof p.onExpand === 'function' && typeof p.value === 'number')?.props;
  if (!props) return undefined;
  const onExpand = props.onExpand as () => void;
  return { value: props.value as number, expand: () => onExpand() };
}

export interface TradeWikibidousEditor {
  /** « Wikibidous que j'offre », « Wikibidous demandés à … ». */
  readonly label: string;
  readonly value: number;
  /** Solde du joueur (son côté seulement, s'il a été lu). */
  readonly maxBalance: number | undefined;
  readonly balanceHint: string | undefined;
  /** Ce que fait son « Enregistrer » : le montant, puis la fermeture du champ. */
  save(value: number): void;
  /** Referme le champ sans rien changer. */
  close(): void;
}

export function readTradeWikibidousEditor(editor: HTMLElement): TradeWikibidousEditor | undefined {
  const input = editor.querySelector('input');
  const props =
    input &&
    findPropsAbove(input, (p) => typeof p.onChange === 'function' && typeof p.onClose === 'function' && typeof p.label === 'string')?.props;
  if (!props) return undefined;
  const onChange = props.onChange as (value: number) => void;
  const onClose = props.onClose as () => void;
  return {
    label: props.label as string,
    value: typeof props.value === 'number' ? props.value : 0,
    maxBalance: typeof props.maxBalance === 'number' ? props.maxBalance : undefined,
    balanceHint: typeof props.balanceHint === 'string' ? props.balanceHint : undefined,
    save: (value) => {
      onChange(value);
      onClose();
    },
    close: () => onClose(),
  };
}

/**
 * Recharge les cartes de l'onglet telles quelles (filtres, page) : le chargement dépend de l'identité du `Set` des
 * raretés, un nouvel ensemble (mêmes raretés) relance son effet. L'état est reconnu à sa valeur, celle que reçoit
 * la liste des raretés. Sinon, la liste elle-même (retour en page 1). Faux si rien n'est lisible.
 */
export function reloadTradeCards(tab: TradeComposerTab): boolean {
  const button = tab.rarityButton;
  const props = button && findPropsAbove(button, isRarityList)?.props;
  if (!button || !props) return false;
  const filter = props.filter as ReadonlySet<unknown>;
  const owner = findPropsAbove(button, (p) => typeof p.friendUsername === 'string');
  const state = owner && stateHooks(owner.fiber).find((hook) => hook.value === filter);
  if (state) state.set(new Set(filter));
  else (props.onChange as (value: Set<unknown>) => void)(new Set(filter));
  return true;
}
