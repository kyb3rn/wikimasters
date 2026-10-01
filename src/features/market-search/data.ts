import { isRecord } from '@/core/guards';
import { createLogger, errorMessage } from '@/core/log';
import { SiteApiError, supabaseFetch, supabaseUserId } from '@/site/api';
import { serverNow } from '@/site/clock';
import {
  auctionsPath,
  cursorAfter,
  pageSize,
  parseAuctionRow,
  type AuctionCursor,
  type AuctionFilters,
  type AuctionRow,
} from './query';

const log = /* @__PURE__ */ createLogger('market-search');

export interface CardInfo {
  readonly title: string;
  readonly category: string;
  /** Absente si la carte cache son image. */
  readonly image: string | undefined;
}

export interface Auction extends AuctionRow {
  readonly card: CardInfo | undefined;
  readonly seller: string | undefined;
}

export interface AuctionPage {
  readonly auctions: readonly Auction[];
  /** Page pleine : il y en a peut-être d'autres. */
  readonly cursor: AuctionCursor | undefined;
}

// Cartes et pseudos ne changent pas d'une page à l'autre : chacun n'est demandé qu'une fois par chargement.
const cards = new Map<string, CardInfo>();
const sellers = new Map<string, string>();

async function readRows(path: string): Promise<unknown[]> {
  const response = await supabaseFetch(`/rest/v1/${path}`);
  const body: unknown = await response.json().catch(() => undefined);
  if (!response.ok) {
    if (response.status === 401) throw new SiteApiError('Session expirée : rechargez la page.', 401);
    const message = isRecord(body) && typeof body.message === 'string' ? body.message : `erreur ${response.status}`;
    throw new SiteApiError(`Supabase a refusé la recherche (${message}).`, response.status);
  }
  const rows: unknown[] = Array.isArray(body) ? body : [];
  return rows;
}

/** Identifiants par requête : une adresse trop longue serait refusée (100 uuid ≈ 3,7 ko). */
const ID_BATCH = 100;

/** Lignes de `table` pour ces identifiants, par lots, un lot à la fois. */
async function readByIds(table: string, select: string, ids: readonly string[]): Promise<unknown[]> {
  const unique = [...new Set(ids)];
  const rows: unknown[] = [];
  for (let start = 0; start < unique.length; start += ID_BATCH) {
    const batch = unique.slice(start, start + ID_BATCH);
    rows.push(...(await readRows(`${table}?select=${select}&id=${encodeURIComponent(`in.(${batch.join(',')})`)}`)));
  }
  return rows;
}

async function loadCards(ids: readonly string[]): Promise<void> {
  const missing = ids.filter((id) => !cards.has(id));
  if (missing.length === 0) return;
  const rows = await readByIds('cards', 'id,wikipedia_title,category,image_url,hide_image', missing);
  for (const row of rows) {
    if (!isRecord(row) || typeof row.id !== 'string' || typeof row.wikipedia_title !== 'string') continue;
    cards.set(row.id, {
      title: row.wikipedia_title,
      category: typeof row.category === 'string' ? row.category : '',
      image: row.hide_image !== true && typeof row.image_url === 'string' ? row.image_url : undefined,
    });
  }
}

async function loadSellers(ids: readonly string[]): Promise<void> {
  const missing = ids.filter((id) => !sellers.has(id));
  if (missing.length === 0) return;
  const rows = await readByIds('profiles', 'id,username', missing);
  for (const row of rows) {
    if (isRecord(row) && typeof row.id === 'string' && typeof row.username === 'string') sellers.set(row.id, row.username);
  }
}

async function loadWishlist(userId: string): Promise<string[]> {
  const rows = await readRows(`wishlist_items?select=card_id&user_id=eq.${encodeURIComponent(userId)}`);
  return rows.flatMap((row) => (isRecord(row) && typeof row.card_id === 'string' ? [row.card_id] : []));
}

export interface SearchContext {
  /** Liste de souhaits relue au début de chaque recherche qui la demande, gardée pour ses pages suivantes. */
  wishlist: readonly string[] | undefined;
}

/**
 * Une page d'enchères actives, puis leurs cartes et vendeurs pas encore connus (petites requêtes par clé primaire,
 * par lots de 100). Cartes ou vendeurs en échec : la page s'affiche sans eux.
 */
export async function searchAuctions(
  filters: AuctionFilters,
  cursor: AuctionCursor | undefined,
  context: SearchContext,
): Promise<AuctionPage> {
  const userId = supabaseUserId();
  if (filters.wishlistOnly && !cursor) context.wishlist = userId ? await loadWishlist(userId) : [];
  const path = auctionsPath(filters, { now: serverNow(), userId, wishlist: context.wishlist, cursor });
  if (!path) return { auctions: [], cursor: undefined };
  const rows = (await readRows(path)).map(parseAuctionRow).filter((row): row is AuctionRow => row !== undefined);
  // Une requête à la fois : les cartes, puis les vendeurs.
  for (const load of [() => loadCards(rows.map((row) => row.cardId)), () => loadSellers(rows.map((row) => row.sellerId))]) {
    try {
      await load();
    } catch (reason) {
      log.warn('détails des annonces :', errorMessage(reason));
    }
  }
  return {
    auctions: rows.map((row) => ({ ...row, card: cards.get(row.cardId), seller: sellers.get(row.sellerId) })),
    cursor: rows.length >= pageSize(filters) ? cursorAfter(rows, filters.sort) : undefined,
  };
}
