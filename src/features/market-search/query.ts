import { isRecord } from '@/core/guards';
import { parseRarity, RARITIES, type Rarity } from '@/site/rarity';

/*
 * Lecture directe de la table `auctions` de Supabase (PostgREST), essais du 30/09/2026 : filtres et tri acceptés,
 * 50 lignes en ≈ 200 ms. Toujours la forme la plus légère : colonnes utiles, jamais de comptage (`count=exact` fait
 * expirer la requête), pages suivantes par curseur sur la clé du tri (pas d'`offset`), une requête à la fois.
 */

export type AuctionSort = 'ending_soon' | 'ending_late' | 'recent';
/** Cases cochées : aucune ou toutes, pas de filtre. */
export type ShinyCase = 'shiny' | 'normal';
export type BidCase = 'with' | 'without';

export interface AuctionFilters {
  readonly search: string;
  readonly rarities: readonly Rarity[];
  readonly shiny: readonly ShinyCase[];
  readonly bids: readonly BidCase[];
  /** Prix affiché : mise actuelle, sinon mise de départ. */
  readonly priceMin: number | undefined;
  readonly priceMax: number | undefined;
  /** Temps restant, en minutes. */
  readonly remainingMin: number | undefined;
  readonly remainingMax: number | undefined;
  readonly atkMin: number | undefined;
  readonly atkMax: number | undefined;
  readonly defMin: number | undefined;
  readonly defMax: number | undefined;
  readonly excludeMine: boolean;
  readonly wishlistOnly: boolean;
  readonly sort: AuctionSort;
  /** Enchères par requête (« Charger la suite » en demande autant). */
  readonly limit: number;
}

/** Enchères par requête : 50 comme le site, jusqu'à 1 000 (plafond de Supabase par défaut, `max-rows`). */
const DEFAULT_LIMIT = 50;
export const LIMIT = { default: DEFAULT_LIMIT, min: 50, max: 1000, step: 50 } as const;

export const DEFAULT_FILTERS: AuctionFilters = {
  search: '',
  rarities: [],
  shiny: [],
  bids: [],
  priceMin: undefined,
  priceMax: undefined,
  remainingMin: undefined,
  remainingMax: undefined,
  atkMin: undefined,
  atkMax: undefined,
  defMin: undefined,
  defMax: undefined,
  excludeMine: false,
  wishlistOnly: false,
  sort: 'ending_soon',
  // Pas `LIMIT.default` : lire une propriété au niveau du module le garderait dans le fichier de production.
  limit: DEFAULT_LIMIT,
};

const only = <T extends string>(checked: readonly T[]): T | undefined => (checked.length === 1 ? checked[0] : undefined);
export const pageSize = (filters: AuctionFilters): number =>
  Math.min(LIMIT.max, Math.max(LIMIT.min, Math.round(filters.limit) || LIMIT.default));

const SORTS: Readonly<Record<AuctionSort, { readonly key: 'end_at' | 'created_at'; readonly dir: 'asc' | 'desc' }>> = {
  ending_soon: { key: 'end_at', dir: 'asc' },
  ending_late: { key: 'end_at', dir: 'desc' },
  recent: { key: 'created_at', dir: 'desc' },
};

/** Dernière ligne reçue, dans l'ordre du tri : la page suivante commence juste après. */
export interface AuctionCursor {
  /** Valeur brute de la clé du tri (précision de Postgres, à la microseconde : jamais repassée par `Date`). */
  readonly key: string;
  readonly id: string;
}

export interface QueryContext {
  /** Heure du serveur, en millisecondes. */
  readonly now: number;
  /** Joueur connecté (« sans mes ventes »). */
  readonly userId: string | undefined;
  /** Cartes de la liste de souhaits (« liste de souhaits seulement »). */
  readonly wishlist: readonly string[] | undefined;
  readonly cursor: AuctionCursor | undefined;
}

const AUCTION_COLUMNS =
  'id,card_id,seller_id,end_at,created_at,base_amount,current_bid,current_bidder_id,snapshot_rarity,snapshot_atk,snapshot_def,is_shiny';

/** Texte comme `snapshot_search_document` : minuscules, sans accents, espaces simples ; jokers retirés. */
export function searchWords(text: string): string[] {
  return text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase()
    .replace(/[*%_\\,()"]/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

/** Valeur dans un arbre logique (`or=(…)`) : entre guillemets, ses `:` `.` `,` y sont réservés. */
const quoted = (value: string) => `"${value.replace(/["\\]/g, '\\$&')}"`;

/** Une condition seule, ou toutes à la fois. */
const every = (conditions: readonly string[]) =>
  conditions.length === 1 ? (conditions[0] ?? '') : `and(${conditions.join(',')})`;

const range = (column: string, min: number | undefined, max: number | undefined) => [
  ...(min === undefined ? [] : [`${column}.gte.${min}`]),
  ...(max === undefined ? [] : [`${column}.lte.${max}`]),
];

/**
 * Chemin de la requête (`auctions?…`, sans `/rest/v1/`), ou `undefined` quand aucune enchère ne peut
 * correspondre (liste de souhaits vide) : pas de requête du tout.
 */
export function auctionsPath(filters: AuctionFilters, context: QueryContext): string | undefined {
  const params: [string, string][] = [
    ['select', AUCTION_COLUMNS],
    ['status', 'eq.active'],
  ];
  const groups: string[] = [];
  const add = (column: string, conditions: readonly string[]) => {
    for (const condition of conditions) params.push([column, condition.slice(column.length + 1)]);
  };

  const minutes = Math.max(0, filters.remainingMin ?? 0);
  params.push(['end_at', `gt.${new Date(context.now + minutes * 60_000).toISOString()}`]);
  if (filters.remainingMax !== undefined) {
    params.push(['end_at', `lte.${new Date(context.now + filters.remainingMax * 60_000).toISOString()}`]);
  }

  for (const word of searchWords(filters.search)) params.push(['snapshot_search_document', `ilike.*${word}*`]);
  if (filters.rarities.length > 0) params.push(['snapshot_rarity', `in.(${filters.rarities.join(',')})`]);
  const shiny = only(filters.shiny);
  if (shiny) params.push(['is_shiny', shiny === 'shiny' ? 'is.true' : 'is.false']);
  add('snapshot_atk', range('snapshot_atk', filters.atkMin, filters.atkMax));
  add('snapshot_def', range('snapshot_def', filters.defMin, filters.defMax));

  // Prix affiché : la mise actuelle s'il y en a une (`current_bid` n'est rempli qu'avec un enchérisseur), sinon la
  // mise de départ.
  const price = (column: string) => range(column, filters.priceMin, filters.priceMax);
  const bids = only(filters.bids);
  if (bids === 'with') {
    params.push(['current_bid', 'not.is.null']);
    add('current_bid', price('current_bid'));
  } else if (bids === 'without') {
    params.push(['current_bid', 'is.null']);
    add('base_amount', price('base_amount'));
  } else if (price('current_bid').length > 0) {
    groups.push(`or(${every(price('current_bid'))},${every(['current_bid.is.null', ...price('base_amount')])})`);
  }

  if (filters.excludeMine && context.userId) params.push(['seller_id', `neq.${context.userId}`]);
  if (filters.wishlistOnly) {
    if (!context.wishlist || context.wishlist.length === 0) return undefined;
    params.push(['card_id', `in.(${context.wishlist.join(',')})`]);
  }

  const { key, dir } = SORTS[filters.sort];
  if (context.cursor) {
    const op = dir === 'asc' ? 'gt' : 'lt';
    const value = quoted(context.cursor.key);
    groups.push(`or(${key}.${op}.${value},and(${key}.eq.${value},id.${op}.${quoted(context.cursor.id)}))`);
  }
  if (groups.length > 0) params.push(['and', `(${groups.join(',')})`]);
  params.push(['order', `${key}.${dir},id.${dir}`], ['limit', String(pageSize(filters))]);

  return `auctions?${params.map(([name, value]) => `${name}=${encodeURIComponent(value)}`).join('&')}`;
}

export interface AuctionRow {
  readonly id: string;
  readonly cardId: string;
  readonly sellerId: string;
  /** Brutes, pour le curseur ; en millisecondes pour l'affichage. */
  readonly endAtRaw: string;
  readonly createdAtRaw: string;
  readonly endAt: number;
  readonly baseAmount: number;
  readonly currentBid: number | null;
  readonly currentBidderId: string | null;
  readonly rarity: Rarity;
  readonly atk: number | null;
  readonly def: number | null;
  readonly shiny: boolean;
}

const numberOrNull = (value: unknown) => (typeof value === 'number' ? value : null);

export function parseAuctionRow(raw: unknown): AuctionRow | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, card_id, seller_id, end_at, created_at, base_amount, current_bid, current_bidder_id } = raw;
  const rarity = parseRarity(raw.snapshot_rarity);
  const endAt = typeof end_at === 'string' ? Date.parse(end_at) : NaN;
  if (typeof id !== 'string' || typeof card_id !== 'string' || typeof seller_id !== 'string') return undefined;
  if (typeof end_at !== 'string' || typeof created_at !== 'string' || !Number.isFinite(endAt)) return undefined;
  if (typeof base_amount !== 'number' || !rarity) return undefined;
  return {
    id,
    cardId: card_id,
    sellerId: seller_id,
    endAtRaw: end_at,
    createdAtRaw: created_at,
    endAt,
    baseAmount: base_amount,
    currentBid: numberOrNull(current_bid),
    currentBidderId: typeof current_bidder_id === 'string' ? current_bidder_id : null,
    rarity,
    atk: numberOrNull(raw.snapshot_atk),
    def: numberOrNull(raw.snapshot_def),
    shiny: raw.is_shiny === true,
  };
}

export function cursorAfter(rows: readonly AuctionRow[], sort: AuctionSort): AuctionCursor | undefined {
  const last = rows.at(-1);
  if (!last) return undefined;
  return { key: SORTS[sort].key === 'end_at' ? last.endAtRaw : last.createdAtRaw, id: last.id };
}

const SHINY_CASES: readonly ShinyCase[] = ['shiny', 'normal'];
const BID_CASES: readonly BidCase[] = ['with', 'without'];

const bound = (value: unknown) => (typeof value === 'number' && Number.isFinite(value) && value >= 0 ? Math.round(value) : undefined);
/** Valeurs connues seulement, dans l'ordre des options. */
const cases = <T extends string>(value: unknown, allowed: readonly T[]): T[] =>
  Array.isArray(value) ? allowed.filter((option) => value.includes(option)) : [];

/** Filtres retenus (localStorage) : chaque champ illisible reprend sa valeur par défaut. */
export function parseFilters(raw: unknown): AuctionFilters | undefined {
  if (!isRecord(raw)) return undefined;
  const sort = (Object.keys(SORTS) as AuctionSort[]).find((key) => key === raw.sort);
  return {
    search: typeof raw.search === 'string' ? raw.search : DEFAULT_FILTERS.search,
    rarities: cases(raw.rarities, RARITIES),
    shiny: cases(raw.shiny, SHINY_CASES),
    bids: cases(raw.bids, BID_CASES),
    priceMin: bound(raw.priceMin),
    priceMax: bound(raw.priceMax),
    remainingMin: bound(raw.remainingMin),
    remainingMax: bound(raw.remainingMax),
    atkMin: bound(raw.atkMin),
    atkMax: bound(raw.atkMax),
    defMin: bound(raw.defMin),
    defMax: bound(raw.defMax),
    excludeMine: raw.excludeMine === true,
    wishlistOnly: raw.wishlistOnly === true,
    sort: sort ?? DEFAULT_FILTERS.sort,
    limit: pageSize({ ...DEFAULT_FILTERS, limit: bound(raw.limit) ?? DEFAULT_FILTERS.limit }),
  };
}

/** Mêmes filtres (pour savoir si la dernière recherche lancée est toujours celle affichée). */
export function sameFilters(a: AuctionFilters, b: AuctionFilters): boolean {
  return (Object.keys(a) as (keyof AuctionFilters)[]).every((key) => {
    const x = a[key];
    const y = b[key];
    return Array.isArray(x) && Array.isArray(y) ? x.join(',') === y.join(',') : x === y;
  });
}
