import type { ModuleId } from '@/core/turbopack';
import { FRIENDS_ROUTE } from '@/site/routes';
import { openSiteWindow, type ModuleLocation, type OpenedSiteWindow, type SiteWindowComponent } from '@/site/windows';

/*
 * Conversation privée du site ouverte par le script là où le site ne l'offre pas (profil d'un ami) ; code du site du
 * 03/10/2026. Composant `{ peer, currentUserId, onClose }` (`peer` : `{ id, username, avatar_url, avatar_pos_x,
 * avatar_pos_y }`), export par défaut de son module, rendu en portail dans `body`. /dms, la page Amis et la guilde
 * l'importent directement, le profil pas : la page Amis est préchargée (`openSiteWindow`).
 *
 * Son propre code n'a pas été relu : on le reconnaît à son usage dans les pages qui le rendent, `X.default` recevant
 * `{ peer, currentUserId, onClose }`, X étant son import (`X=e.i(<id>)`).
 *   /dms : (0,t.jsx)(l.default,{peer:$,currentUserId:T,onClose:U})
 *   Amis : (0,t.jsx)(g.default,{peer:{id:e,username:a,avatar_url:n??null,…},currentUserId:S,onClose:()=>w(!1)})
 */

const USE = /([\w$]+)\.default,\{peer:(?=[^;]{0,300}?currentUserId:)(?=[^;]{0,300}?onClose:)/g;

const escape = (name: string): string => name.replace(/\$/g, '\\$');

/** Module de la conversation, d'après une page qui la rend (et dont il est un import). */
export function locateChatWindow(sources: Iterable<readonly [ModuleId, string]>): ModuleLocation | undefined {
  for (const [, source] of sources) {
    if (!source.includes('currentUserId:')) continue;
    for (const [, alias] of source.matchAll(USE)) {
      const id = alias && new RegExp(`(?:^|[^\\w$.])${escape(alias)}=[\\w$]+\\.i\\((\\d+)\\)`).exec(source)?.[1];
      if (id) return { module: Number(id) };
    }
  }
  return undefined;
}

const CHAT_WINDOW: SiteWindowComponent = { name: 'conversation', locate: locateChatWindow, route: FRIENDS_ROUTE };

/** Interlocuteur, tel que la page Amis le passe. */
export interface ChatWindowPeer {
  readonly id: string;
  readonly username: string;
  readonly avatarUrl: string | null;
  readonly avatarPosX: number | undefined;
  readonly avatarPosY: number | undefined;
}

export interface ChatWindowOptions {
  /** Joueur connecté. */
  readonly currentUserId: string;
  /** Nœud de l'arbre du site sous lequel lire les contextes à refournir. */
  readonly contextFrom: Node;
  readonly signal: AbortSignal;
  /** Fenêtre fermée par le site (croix, fond). */
  readonly onClosed?: () => void;
  readonly onError?: (error: unknown) => void;
}

/**
 * Ouvre la conversation du site avec ce joueur, comme « Message » de la page Amis. Rejet : `SiteWindowUnavailable`
 * (le site a changé), `ChunkLoadError` (morceau du site pas reçu).
 */
export function openChatWindow(peer: ChatWindowPeer, { currentUserId, ...options }: ChatWindowOptions): Promise<OpenedSiteWindow> {
  return openSiteWindow(
    CHAT_WINDOW,
    {
      peer: {
        id: peer.id,
        username: peer.username,
        avatar_url: peer.avatarUrl,
        avatar_pos_x: peer.avatarPosX,
        avatar_pos_y: peer.avatarPosY,
      },
      currentUserId,
    },
    { ...options, closeProps: ['onClose'] },
  );
}
