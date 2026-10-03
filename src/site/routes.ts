/*
 * Pages du site (motifs de `matchRoute`), pour les `routes` des fonctionnalités et la navigation. Le site est une
 * application Next.js : ces adresses changent sans rechargement (voir `core/router`).
 */

/**
 * Paramètre d'adresse d'une page à nous posée sur une page du site (`/collection?vue=revente`) : le site l'ignore et
 * affiche sa page, qui reste là, cachée, avec son menu et ses contextes React. Le routeur en fait une autre page :
 * les motifs sans `?vue=…` ne la reconnaissent pas.
 */
export const VIEW_PARAM = 'vue';
/** Paramètres d'adresse qui changent de page, pour le routeur. */
export const ROUTE_VIEW_KEYS: readonly string[] = [VIEW_PARAM];

export const PULLS_ROUTE = '/pulls';
export const COLLECTION_ROUTE = '/collection';
/** Revente : page à nous, sur la Collection du site. */
export const RESALE_ROUTE = `${COLLECTION_ROUTE}?${VIEW_PARAM}=revente`;
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
