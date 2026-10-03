import type { ModuleId } from '@/core/turbopack';
import { COLLECTION_ROUTE } from '@/site/routes';
import { openSiteWindow, type ModuleLocation, type OpenedSiteWindow, type SiteWindowComponent } from '@/site/windows';

/*
 * Modale de carte du site ouverte par le script, pour un exemplaire qu'aucune page du site n'affiche (page Revente) ;
 * code du site du 03/10/2026 (module 515678). Composant `{ card, starred, count, onClose, onToggleStar, userCardId,
 * tags = [], tagsCatalog, tagsReadOnly, onTagsChange, friendUsername, friendProfileId, friendOfferPending,
 * ownOfferPending, onCollectionChange, catalogView, wishlisted, onToggleWishlist }`, rendu en portail dans `body`.
 * La Collection le rend avec un de ses exemplaires : `card` aux valeurs de l'exemplaire, `count` = exemplaires de la
 * carte dans sa liste (Vendre et Défausser n'apparaissent que s'il est positif), le favori demandé à Supabase par
 * la page (`onToggleStar`), les étiquettes posées par la modale elle-même (`onTagsChange` reçoit la nouvelle liste ;
 * sans `tagsCatalog`, elle lit les étiquettes du joueur), `onCollectionChange` après une défausse ou une mise en
 * vente. Défausse réussie : `onCollectionChange` puis `onClose`.
 */

/** Le composant : ses paramètres déstructurés commencent par la carte, le favori, le nombre et la fermeture. */
const MODAL = /function\s*[\w$]*\(\{card:[\w$]+,starred:[\w$]+,count:[\w$]+,onClose:[\w$]+,onToggleStar:[\w$]+,userCardId:/;

export function locateCardModal(sources: Iterable<readonly [ModuleId, string]>): ModuleLocation | undefined {
  for (const [id, source] of sources) {
    if (source.includes('onCollectionChange:') && MODAL.test(source)) return { module: id };
  }
  return undefined;
}

const CARD_MODAL: SiteWindowComponent = { name: 'modale de carte', locate: locateCardModal, route: COLLECTION_ROUTE };

/** Props de la modale pour un de mes exemplaires (celles de fermeture sont fournies par `openCardModal`). */
export interface CardModalProps {
  /** La carte aux valeurs de l'exemplaire (forme des listes du site). */
  readonly card: Readonly<Record<string, unknown>>;
  readonly userCardId: string;
  readonly starred: boolean;
  /** Exemplaires de la carte connus : Vendre et Défausser n'apparaissent que s'il est positif. */
  readonly count: number;
  readonly tags: readonly unknown[];
  readonly onToggleStar: () => void;
  readonly onTagsChange: (tags: unknown) => void;
  readonly onCollectionChange: () => void;
}

export interface CardModalOptions {
  /** Nœud de l'arbre du site sous lequel lire les contextes à refournir. */
  readonly contextFrom: Node;
  readonly signal: AbortSignal;
  /** Modale fermée par le site (croix, fond, après une défausse). */
  readonly onClosed?: () => void;
  readonly onError?: (error: unknown) => void;
}

export interface OpenedCardModal {
  update(props: CardModalProps): void;
  close(): void;
}

/**
 * Ouvre la modale de carte du site pour un exemplaire, comme la Collection. Rejet : `SiteWindowUnavailable` (le site
 * a changé), `ChunkLoadError` (morceau du site pas reçu).
 */
export async function openCardModal(props: CardModalProps, options: CardModalOptions): Promise<OpenedCardModal> {
  const toSite = (current: CardModalProps) => ({ ...current, tagsCatalog: undefined, ownOfferPending: false });
  const opened: OpenedSiteWindow = await openSiteWindow(CARD_MODAL, toSite(props), { ...options, closeProps: ['onClose'] });
  return { update: (next) => opened.update(toSite(next)), close: () => opened.close() };
}
