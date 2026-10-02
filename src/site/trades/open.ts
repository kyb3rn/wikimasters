import { isRecord } from '@/core/guards';
import { findPageReact, renderPageComponent } from '@/core/page-react';
import { currentFiberAncestors, providedContexts } from '@/core/react';
import { pageModules, type ModuleId, type PageModules } from '@/core/turbopack';

/*
 * Fenêtre d'échange du site ouverte par le script là où le site ne l'offre pas (profil d'un ami) ; code du site du
 * 02/10/2026. Composant `{ friendUsername, friendProfileId, preselectedFriendCard, preselectedFriendCards,
 * parentTradeId, preselectedMyCards, preselectedMyWikibidous, preselectedFriendWikibidous, onClose, onSent }`, rendu
 * en portail dans `body` ; la page Amis lui passe `{ friendUsername, friendProfileId, onClose, onSent }`, et `onSent`
 * ferme la fenêtre comme `onClose`.
 *
 * La page Amis et /trades l'importent directement. Sur un profil, seule la modale d'un exemplaire de l'ami le charge,
 * par un import dynamique, dans son enveloppe de « Proposer un échange » :
 *   function $({ friendUsername, friendProfileId, preselectedFriendCard, onClose }) {
 *     … useEffect(() => { e.A(<chargeur>).then((m) => set(() => m.default)) }, []) …
 *   }
 * Le composant lit le joueur connecté par un contexte (`useUserId`, qui lève une erreur hors de son fournisseur) et
 * le réglage des images sensibles par un autre : ceux de l'arbre de la page lui sont refournis.
 */

/** Le composant lui-même : parmi ses paramètres déstructurés, `parentTradeId` et `onSent`. */
const COMPOSER = /function\s*[\w$]*\(\{(?=[^}]*\bparentTradeId:)(?=[^}]*\bonSent:)friendUsername:[\w$]+,friendProfileId:[\w$]+,/;

/** Une enveloppe (paramètres sans `parentTradeId`), puis le premier import dynamique de son corps. */
const WRAPPER = /function\s*[\w$]*\(\{friendUsername:[\w$]+,friendProfileId:[\w$]+([^}]*)\}\)\{(?:(?!function)[^]){0,400}?\.A\((\d+)\)/g;

export class TradeComposerUnavailable extends Error {
  override readonly name = 'TradeComposerUnavailable';
}

/** Identifiant du module du composant parmi les fabriques inscrites, sinon celui de son chargeur dynamique. */
export function locateTradeComposer(
  sources: Iterable<readonly [ModuleId, string]>,
): { readonly module: ModuleId } | { readonly loader: number } | undefined {
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

function defaultOf(namespace: unknown): unknown {
  const component = isRecord(namespace) ? namespace.default : undefined;
  if (typeof component !== 'function') throw new TradeComposerUnavailable('module sans composant');
  return component;
}

async function loadComposer(modules: PageModules): Promise<unknown> {
  const found = locateTradeComposer(modules.sources());
  if (!found) throw new TradeComposerUnavailable('fenêtre d’échange introuvable parmi les modules');
  return defaultOf('module' in found ? modules.require(found.module) : await modules.load(found.loader));
}

export interface TradeComposerTarget {
  readonly friendUsername: string;
  readonly friendProfileId: string;
}

export interface TradeComposerOptions {
  /** Nœud de l'arbre du site sous lequel lire les contextes à refournir. */
  readonly contextFrom: Node;
  /** Fenêtre fermée par le site (croix, Annuler, Échap, offre envoyée). */
  readonly onClosed?: () => void;
  /** Erreur pendant un rendu de la fenêtre (elle disparaît). */
  readonly onError?: (error: unknown) => void;
}

export interface OpenedTradeComposer {
  close(): void;
}

/**
 * Ouvre la fenêtre « Échanger avec … » du site pour cet ami, comme la page Amis. Rejet : `TradeComposerUnavailable`
 * (le site a changé), `ChunkLoadError` de Turbopack (morceau du site pas reçu).
 */
export async function openTradeComposer(
  target: TradeComposerTarget,
  { contextFrom, onClosed, onError }: TradeComposerOptions,
): Promise<OpenedTradeComposer> {
  const modules = await pageModules();
  if (!modules) throw new TradeComposerUnavailable('modules de la page illisibles');
  const react = findPageReact(modules.loaded());
  if (!react) throw new TradeComposerUnavailable('React de la page introuvable');
  const composer = await loadComposer(modules);
  const contexts = providedContexts(currentFiberAncestors(contextFrom));

  let open = true;
  const close = (): void => {
    if (!open) return;
    open = false;
    handle.unmount();
  };
  const closedBySite = (): void => {
    if (!open) return;
    close();
    onClosed?.();
  };
  const handle = renderPageComponent(
    react,
    composer,
    { friendUsername: target.friendUsername, friendProfileId: target.friendProfileId, onClose: closedBySite, onSent: closedBySite },
    {
      contexts,
      onError: (error) => {
        close();
        onError?.(error);
      },
    },
  );
  return { close };
}
