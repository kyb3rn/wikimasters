/*
 * Pages du site (motifs de `matchRoute`), pour les `routes` des fonctionnalités et la navigation. Le site est une
 * application Next.js : ces adresses changent sans rechargement (voir `core/router`).
 */

export const PULLS_ROUTE = '/pulls';
export const COLLECTION_ROUTE = '/collection';
/** Toutes les cartes. */
export const GLOBAL_COLLECTION_ROUTE = '/global-collection';
export const MARKETPLACE_ROUTE = '/marketplace';
/** Page d'une enchère. */
export const AUCTION_ROUTE = '/marketplace/:id';
/** Son propre profil. */
export const MY_PROFILE_ROUTE = '/profile';
/** Profil d'un joueur, soi compris (`profilePath` de `site/profile` pour y aller). */
export const PROFILE_ROUTE = '/profile/:name';
export const TRADES_ROUTE = '/trades';
export const FRIENDS_ROUTE = '/friends';
/** Messages privés. */
export const DMS_ROUTE = '/dms';
export const GUILD_ROUTE = '/guild';
/** Batailles (aucune fonctionnalité ne s'y monte : pages ouvertes par les notifications). */
export const BATTLE_ROUTE = '/battle';

/** Page d'une enchère : `/marketplace/<id>`. */
export function auctionPath(id: string): string {
  return `${MARKETPLACE_ROUTE}/${encodeURIComponent(id)}`;
}
