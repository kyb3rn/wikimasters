import { later } from '@/core/async';
import type { NetRequest } from '@/core/net';
import { appendRarities, readBaseListQuery, type BaseListQuery } from '@/site/list-query';

/*
 * Catalogue « Toutes les cartes » (code du site, 30/09/2026) : une requête par chargement,
 * `GET /api/cards?page=&q=&rarity=…&sort=[&wishlist=1]` (50 cartes par page, `page` à partir de 0), total et
 * compteurs compris. Chaque réponse est gardée en `sessionStorage` sous `gc_v11_<adresse>` (sauf « Liste de
 * souhaits ») : une page déjà vue dans l'onglet ne redemande rien, elle s'affiche aussitôt.
 */

export interface GlobalCollectionQuery extends BaseListQuery {
  /** « Liste de souhaits » : seulement les cartes de la sienne. */
  readonly wishlist: boolean;
}

export function isGlobalCollectionList(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/cards';
}

export function readGlobalCollectionQuery(url: URL): GlobalCollectionQuery {
  return { ...readBaseListQuery(url.searchParams), wishlist: url.searchParams.get('wishlist') === '1' };
}

/** Mêmes choix : tri, raretés, liste de souhaits. */
export function sameGlobalCollectionChoice(a: GlobalCollectionQuery, b: GlobalCollectionQuery): boolean {
  return a.sort === b.sort && a.rarities === b.rarities && a.wishlist === b.wishlist;
}

/** Adresse de la liste avec les filtres de `query`, sa page gardée. Paramètres dans l'ordre du site. */
export function withGlobalCollectionFilters(url: URL, query: GlobalCollectionQuery): URL {
  const params = new URLSearchParams({ page: url.searchParams.get('page') ?? '0' });
  if (query.search) params.set('q', query.search);
  appendRarities(params, query.rarities);
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

/** Le site garde une réponse après l'avoir lue : laisser le temps à celle qu'il vient de recevoir. */
const KEEP_DELAY = 500;

/** `forgetGlobalCollectionPages` tout de suite, puis une fois que le site a gardé la réponse qu'il reçoit. */
export function forgetGlobalCollectionPagesSoon(signal: AbortSignal): void {
  forgetGlobalCollectionPages();
  for (const delay of [0, KEEP_DELAY]) later(forgetGlobalCollectionPages, delay, signal);
}
