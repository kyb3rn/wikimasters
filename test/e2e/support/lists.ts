import type { Page } from '@playwright/test';
import type { FakeSite, Gated } from './site';

/**
 * Titre de la carte servie par un serveur de liste imité : il dit la requête, pour que le test voie quels filtres
 * sont partis (« name L+R #t1 ♥ «tour» p0 » : tri ou `head`, raretés, étiquette ou `#aucune` pour `untagged=1`,
 * liste de souhaits, recherche, page).
 */
export function filtersTitle(params: URLSearchParams, head = params.get('sort') ?? ''): string {
  const rarities = params.getAll('rarity').sort().join('+') || 'toutes';
  const tag = params.get('untagged') === '1' ? ' #aucune' : params.get('tag_id') ? ` #${params.get('tag_id')}` : '';
  const wishlist = params.get('wishlist') === '1' || params.has('wishlisted_by') || params.has('wishlisted_by_me') ? ' ♥' : '';
  const search = params.get('q') ? ` «${params.get('q')}»` : '';
  return `${head} ${rarities}${tag}${wishlist}${search} p${params.get('page')}`;
}

export interface ListServer extends Gated {
  /** Paramètres des listes demandées, dans l'ordre. */
  readonly requests: string[];
}

/**
 * Serveur d'une liste imitée : chaque requête de `path` est notée (`requests`), attend `gate` (`hold`), puis reçoit
 * `body(params, n)`, `n` étant son rang (à partir de 1). `handle` : à passer à `openSite`.
 */
export function listServer(
  path: string,
  body: (params: URLSearchParams, count: number) => unknown,
): { server: ListServer; handle: NonNullable<FakeSite['handle']> } {
  const server: ListServer = { requests: [], gate: undefined };
  return {
    server,
    handle: async (route, url) => {
      if (url.pathname !== path) return false;
      server.requests.push(url.searchParams.toString());
      await server.gate;
      await route.fulfill({ json: body(url.searchParams, server.requests.length) });
      return true;
    },
  };
}

/** Titres des cartes de la grille des listes imitées (`#grid`), dans l'ordre. */
export const gridTitles = (page: Page) => page.locator('#grid h3');

/** Case d'une rareté de nos filtres (`RarityFilter`). */
export const rarityBox = (page: Page, rarity: string) =>
  page.locator('.wm-rarity-filter .wm-rarity', { hasText: new RegExp(`^${rarity}$`) });
