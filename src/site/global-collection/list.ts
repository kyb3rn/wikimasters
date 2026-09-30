import type { NetRequest } from '@/core/net';

/**
 * Catalogue « Toutes les cartes » (code du site, 30/09/2026) : une requête par chargement,
 * `GET /api/cards?page=&q=&rarity=…&sort=[&wishlist=1]` (50 cartes par page, `page` à partir de 0), total et
 * compteurs compris. Chaque réponse est gardée en `sessionStorage` sous `gc_v11_<adresse>` (sauf « Liste de
 * souhaits ») : une page déjà vue dans l'onglet ne redemande rien, elle s'affiche aussitôt.
 */
export const GLOBAL_COLLECTION_ROUTE = '/global-collection';

export interface GlobalCollectionQuery {
  readonly sort: string;
  readonly search: string;
  /** Raretés cochées, triées. */
  readonly rarities: string;
  /** « Liste de souhaits » : seulement les cartes de la sienne. */
  readonly wishlist: boolean;
  /** À partir de 0. */
  readonly page: number | undefined;
}

export function isGlobalCollectionList(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/cards';
}

export function readGlobalCollectionQuery(url: URL): GlobalCollectionQuery {
  const params = url.searchParams;
  const page = Number(params.get('page'));
  return {
    sort: params.get('sort') ?? '',
    search: params.get('q') ?? '',
    rarities: params.getAll('rarity').sort().join(','),
    wishlist: params.get('wishlist') === '1',
    page: params.has('page') && Number.isInteger(page) ? page : undefined,
  };
}

/** Mêmes choix : tri, raretés, liste de souhaits. */
export function sameGlobalCollectionChoice(a: GlobalCollectionQuery, b: GlobalCollectionQuery): boolean {
  return a.sort === b.sort && a.rarities === b.rarities && a.wishlist === b.wishlist;
}

/** Adresse de la liste avec les filtres de `query`, sa page gardée. Paramètres dans l'ordre du site. */
export function withGlobalCollectionFilters(url: URL, query: GlobalCollectionQuery): URL {
  const params = new URLSearchParams({ page: url.searchParams.get('page') ?? '0' });
  if (query.search) params.set('q', query.search);
  for (const rarity of query.rarities ? query.rarities.split(',') : []) params.append('rarity', rarity);
  params.set('sort', query.sort);
  if (query.wishlist) params.set('wishlist', '1');
  const next = new URL(url.href);
  next.search = params.toString();
  return next;
}

const CACHE_PREFIX = 'gc_v11_';

/**
 * Oublie les pages gardées par le site dans l'onglet : il les redemandera. Sans quoi un changement de filtre
 * s'afficherait sans requête (rien à retenir), ou une réponse resservie par le script resterait gardée sous
 * l'adresse de filtres qui ne sont pas les siens.
 */
export function forgetGlobalCollectionPages(): void {
  try {
    const keys: string[] = [];
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i);
      if (key?.startsWith(CACHE_PREFIX)) keys.push(key);
    }
    for (const key of keys) sessionStorage.removeItem(key);
  } catch {
    // Stockage inaccessible : le site ne garde rien non plus.
  }
}

/** Requêtes de la liste et ce qu'elles disent (pour la recherche retenue, le délai, la mémoire des filtres). */
export const globalCollectionList = {
  isList: isGlobalCollectionList,
  readQuery: readGlobalCollectionQuery,
  sameChoice: sameGlobalCollectionChoice,
};
