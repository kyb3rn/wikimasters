import type { NetRequest } from '@/core/net';
import type { RarityPills } from '@/site/rarity-pills';

/*
 * Requêtes des listes filtrées du site (Collection, Toutes les cartes, marché, collection d'un ami ; code du 29 et
 * 30/09/2026) : `sort=`, `q=` (la recherche), `rarity=` répété (une fois par rareté cochée), `page=`, plus les
 * filtres propres à chaque page.
 */

/** Attente du site après la dernière frappe dans un champ de recherche qui part de lui-même, avant de charger. */
export const SITE_TYPING_DELAY = 300;

/** Filtres d'une requête de liste du site : une recherche, une page, et des choix (tri, raretés…). */
export interface ListQuery {
  readonly search: string;
  /** Absente d'une requête sans page (compteurs de la Collection). */
  readonly page: number | undefined;
}

/** Filtres communs à toutes les listes. */
export interface BaseListQuery extends ListQuery {
  readonly sort: string;
  /** Raretés cochées, triées, séparées par des virgules. */
  readonly rarities: string;
}

export function readBaseListQuery(params: URLSearchParams): BaseListQuery {
  const page = Number(params.get('page'));
  return {
    sort: params.get('sort') ?? '',
    search: params.get('q') ?? '',
    rarities: params.getAll('rarity').sort().join(','),
    page: params.has('page') && Number.isInteger(page) ? page : undefined,
  };
}

/** Raretés d'une requête (`rarities`), une par une. */
export function splitRarities(rarities: string): string[] {
  return rarities ? rarities.split(',') : [];
}

/** `rarity=` répété, une fois par rareté. */
export function appendRarities(params: URLSearchParams, rarities: string): void {
  for (const rarity of splitRarities(rarities)) params.append('rarity', rarity);
}

/** Raretés cochées dans les pastilles du site, comme les écrit `readBaseListQuery`. */
export function checkedRarities(pills: RarityPills): string {
  return pills.pills
    .filter((pill) => pill.checked)
    .map((pill) => pill.rarity)
    .sort()
    .join(',');
}

/** Liste filtrée d'une page du site : ses requêtes, ce qu'elles disent, et ce que la page en fait. */
export interface ListSource<Q extends ListQuery> {
  /** Nom de la liste (journaux, feuilles de style). */
  readonly id: string;
  isList(request: NetRequest): boolean;
  readQuery(url: URL): Q;
  /** Mêmes choix : tout sauf la recherche et la page. */
  sameChoice(a: Q, b: Q): boolean;
  /**
   * Requête qui part juste avant la liste, dans le même chargement et avec les mêmes filtres (compteurs de la
   * Collection, en page 0 seulement) : retenue, retardée et resservie avec elle.
   */
  isCompanion?(request: NetRequest): boolean;
  /** Page qui s'ajoute à la liste affichée (« Charger la suite ») au lieu de la remplacer. */
  appends?(query: Q): boolean;
  /** Champ de recherche de la page. */
  field?(): HTMLInputElement | undefined;
  /** La page lance elle-même sa recherche ce délai après la dernière frappe ; sinon, seulement à Entrée ou par son bouton. */
  readonly typingDelay?: number;
  /**
   * Liste que la page affiche sans l'avoir demandée (remise par le site de ce qu'il a gardé dans l'onglet), à lire
   * au montage, avant qu'elle ne s'affiche : sans elle, rien ne dirait ce qui est affiché.
   */
  kept?(): Q | undefined;
}
