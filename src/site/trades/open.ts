import type { ModuleId } from '@/core/turbopack';
import { FRIENDS_ROUTE } from '@/site/routes';
import { openSiteWindow, type ModuleLocation, type OpenedSiteWindow, type SiteWindowComponent } from '@/site/windows';

/*
 * Fenêtre d'échange du site ouverte par le script là où le site ne l'offre pas (profil d'un ami, conversation de
 * /dms) ; code du site du 03/10/2026. Composant `{ friendUsername, friendProfileId, preselectedFriendCard,
 * preselectedFriendCards, parentTradeId, preselectedMyCards, preselectedMyWikibidous, preselectedFriendWikibidous,
 * onClose, onSent }`, rendu en portail dans `body` ; la page Amis lui passe `{ friendUsername, friendProfileId,
 * onClose, onSent }`, et `onSent` ferme la fenêtre comme `onClose`.
 *
 * La page Amis, /trades et la guilde l'importent directement. Sur un profil, seule la modale d'un exemplaire de l'ami
 * le charge, par un import dynamique, dans son enveloppe de « Proposer un échange » :
 *   function $({ friendUsername, friendProfileId, preselectedFriendCard, onClose }) {
 *     … useEffect(() => { e.A(<chargeur>).then((m) => set(() => m.default)) }, []) …
 *   }
 * /dms ne l'a pas : la page Amis est préchargée (`openSiteWindow`).
 * Le composant lit le joueur connecté par un contexte (`useUserId`, qui lève une erreur hors de son fournisseur) et
 * le réglage des images sensibles par un autre : ceux de l'arbre de la page lui sont refournis.
 */

/** Le composant lui-même : parmi ses paramètres déstructurés, `parentTradeId` et `onSent`. */
const COMPOSER = /function\s*[\w$]*\(\{(?=[^}]*\bparentTradeId:)(?=[^}]*\bonSent:)friendUsername:[\w$]+,friendProfileId:[\w$]+,/;

/** Une enveloppe (paramètres sans `parentTradeId`), puis le premier import dynamique de son corps. */
const WRAPPER = /function\s*[\w$]*\(\{friendUsername:[\w$]+,friendProfileId:[\w$]+([^}]*)\}\)\{(?:(?!function)[^]){0,400}?\.A\((\d+)\)/g;

/** Identifiant du module du composant parmi les fabriques inscrites, sinon celui de son chargeur dynamique. */
export function locateTradeComposer(sources: Iterable<readonly [ModuleId, string]>): ModuleLocation | undefined {
  let loader: number | undefined;
  for (const [id, source] of sources) {
    if (!source.includes('friendProfileId:')) continue;
    if (COMPOSER.test(source)) return { module: id };
    for (const match of source.matchAll(WRAPPER)) {
      if (!match[1]?.includes('parentTradeId:') && match[2]) loader ??= Number(match[2]);
    }
  }
  return loader === undefined ? undefined : { loader };
}

const TRADE_COMPOSER: SiteWindowComponent = {
  name: "fenêtre d'échange",
  locate: locateTradeComposer,
  route: FRIENDS_ROUTE,
};

export interface TradeComposerTarget {
  readonly friendUsername: string;
  readonly friendProfileId: string;
}

export interface TradeComposerOptions {
  /** Nœud de l'arbre du site sous lequel lire les contextes à refournir. */
  readonly contextFrom: Node;
  /** Ouverture abandonnée (page quittée). */
  readonly signal: AbortSignal;
  /** Fenêtre fermée par le site (croix, Annuler, Échap, offre envoyée). */
  readonly onClosed?: () => void;
  /** Erreur pendant un rendu de la fenêtre (elle disparaît). */
  readonly onError?: (error: unknown) => void;
}

/**
 * Ouvre la fenêtre « Échanger avec … » du site pour cet ami, comme la page Amis. Rejet : `SiteWindowUnavailable`
 * (le site a changé), `ChunkLoadError` (morceau du site pas reçu).
 */
export function openTradeComposer(target: TradeComposerTarget, options: TradeComposerOptions): Promise<OpenedSiteWindow> {
  return openSiteWindow(
    TRADE_COMPOSER,
    { friendUsername: target.friendUsername, friendProfileId: target.friendProfileId },
    { ...options, closeProps: ['onClose', 'onSent'] },
  );
}
