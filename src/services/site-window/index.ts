import type { Logger } from '@/core/log';
import { NETWORK_ERROR, supabaseUserId } from '@/site/api';
import { openChatWindow, type ChatWindowPeer } from '@/site/dms';
import { openTradeComposer, type TradeComposerTarget } from '@/site/trades';
import type { OpenedSiteWindow } from '@/site/windows';
import { toast } from '@/ui/toast';

/*
 * Fenêtres du site ouvertes sur place par nos boutons (« Échanger », « Message ») là où le site ne les offre pas :
 * roue pendant le chargement de leur code, échec en toast, fermées avec la page.
 */

export interface SiteWindowButton {
  /** Fenêtre en cours d'ouverture (code du site à charger) : roue, bouton désactivé. */
  readonly busy: boolean;
  /** Ouvre la fenêtre ; rien si elle l'est déjà, ou en train de l'être. */
  readonly open: () => void;
}

export interface SiteWindowButtonOptions {
  /** Page quittée : ouverture abandonnée, fenêtre fermée. */
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** `busy` a changé. */
  readonly onChange: () => void;
}

interface OpenerSpec {
  readonly title: string;
  /** Fenêtre introuvable (le site a changé). */
  readonly failure: string;
  readonly open: (handlers: {
    readonly signal: AbortSignal;
    readonly onClosed: () => void;
    readonly onError: (error: unknown) => void;
  }) => Promise<OpenedSiteWindow>;
}

/** Morceau de code du site pas reçu (Turbopack) : panne réseau, comme une requête sans réponse. */
const isChunkLoadError = (error: unknown): boolean => error instanceof Error && error.name === 'ChunkLoadError';

function siteWindowButton({ signal, log, onChange }: SiteWindowButtonOptions, spec: OpenerSpec): SiteWindowButton {
  let busy = false;
  let opened: OpenedSiteWindow | undefined;
  signal.addEventListener('abort', () => opened?.close(), { once: true });

  function failed(error: unknown): void {
    if (signal.aborted) return;
    log.error(`${spec.title} :`, error);
    toast.error(isChunkLoadError(error) ? NETWORK_ERROR : spec.failure, { title: spec.title });
  }

  async function open(): Promise<void> {
    if (busy || opened || signal.aborted) return;
    busy = true;
    onChange();
    try {
      const window = await spec.open({
        signal,
        onClosed: () => {
          opened = undefined;
        },
        onError: (error) => {
          opened = undefined;
          failed(error);
        },
      });
      if (signal.aborted) window.close();
      else opened = window;
    } catch (error) {
      failed(error);
    } finally {
      busy = false;
      if (!signal.aborted) onChange();
    }
  }

  return {
    get busy() {
      return busy;
    },
    open: () => void open(),
  };
}

const missing = (what: string): Promise<never> => Promise.reject(new Error(`${what} introuvable dans la page`));

export const TRADE_WINDOW_ERROR = "La fenêtre d'échange du site n'a pas pu s'ouvrir.";
export const CHAT_WINDOW_ERROR = "La conversation du site n'a pas pu s'ouvrir.";

export interface TradeWindowTarget extends TradeComposerTarget {
  /** Nœud de l'arbre du site sous lequel lire ses contextes. */
  readonly contextFrom: Node;
}

/** « Échanger » : fenêtre d'échange du site avec cet ami, comme sur la page Amis. `target` est lu au clic. */
export function tradeWindowButton(
  options: SiteWindowButtonOptions & { readonly target: () => TradeWindowTarget | undefined },
): SiteWindowButton {
  return siteWindowButton(options, {
    title: 'Échanges',
    failure: TRADE_WINDOW_ERROR,
    open: (handlers) => {
      const target = options.target();
      return target ? openTradeComposer(target, { ...handlers, contextFrom: target.contextFrom }) : missing("identifiant de l'ami");
    },
  });
}

export interface ChatWindowTarget {
  readonly peer: ChatWindowPeer;
  readonly contextFrom: Node;
}

/** « Message » : conversation du site avec ce joueur, comme sur la page Amis. `target` est lu au clic. */
export function chatWindowButton(
  options: SiteWindowButtonOptions & { readonly target: () => ChatWindowTarget | undefined },
): SiteWindowButton {
  return siteWindowButton(options, {
    title: 'Messages',
    failure: CHAT_WINDOW_ERROR,
    open: (handlers) => {
      const target = options.target();
      const currentUserId = supabaseUserId();
      if (!target) return missing("identifiant de l'ami");
      if (!currentUserId) return missing('joueur connecté');
      return openChatWindow(target.peer, { ...handlers, currentUserId, contextFrom: target.contextFrom });
    },
  });
}
