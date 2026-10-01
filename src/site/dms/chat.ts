import { SITE_OVERLAY } from '@/site/modals';

/**
 * Conversation privée ouverte depuis `/dms` (captures du 29/09/2026) : modale du site (portail dans `body`),
 * feuille en bas sur mobile.
 *
 *   div.fixed.inset-0.z-50 (fond)
 *     div.card-frame.flex.flex-col (cadre, `sm:max-w-md sm:h-[600px]`)
 *       div.flex.items-center.gap-3.border-b (en-tête)
 *         div.rounded-full (photo : `img[alt=pseudo]`, sinon initiales en `span`)
 *         div.flex-1.min-w-0 > p.font-semibold (pseudo, `peer_username` de `/api/chat`)
 *         button « Fermer »
 *       div.flex-1.overflow-y-auto (messages, échanges)
 *       barre du message
 *
 * Tant qu'elle est ouverte, elle suit ses canaux temps réel (`chat:<ami>:<moi>`, `chat-trades:<ami>:<moi>`) ; à sa
 * fermeture, le site les quitte et relit la liste des conversations.
 */
export interface ChatPeer {
  /** `p` du pseudo, rendu par le site. */
  readonly name: HTMLElement;
  /** Rond de la photo (ou des initiales). */
  readonly avatar: HTMLElement;
  readonly username: string;
}

export interface ChatWindow {
  readonly overlay: HTMLElement;
  readonly frame: HTMLElement;
  readonly close: HTMLButtonElement;
  /** Interlocuteur ; pour la conversation de guilde, son nom et son icône. */
  readonly peer: ChatPeer;
  /** Conversation de guilde du script (même balisage, `GUILD_CHAT_CLASS` sur le cadre). */
  readonly guild: boolean;
}

/** Cadre de la conversation de guilde du script, au balisage d'une conversation du site. */
export const GUILD_CHAT_CLASS = 'wm-guild-chat';

const HEADER = 'div.flex.items-center.gap-3.border-b';

function readHeader(header: HTMLElement): (ChatPeer & { close: HTMLButtonElement }) | undefined {
  const avatar = header.querySelector<HTMLElement>(':scope > div.rounded-full:first-child');
  const name = header.querySelector<HTMLElement>(':scope > div.flex-1.min-w-0 > p.font-semibold');
  const close = header.querySelector<HTMLButtonElement>(':scope > button[aria-label="Fermer"]');
  // Pseudo exact (pas d'espaces réduits) : il sert à l'adresse du profil.
  const username = (name?.textContent ?? '').trim();
  return avatar && name && close && username !== '' ? { name, avatar, username, close } : undefined;
}

/** Conversations ouvertes : fond, cadre, fermeture du site et interlocuteur. */
export function findChatWindows(doc: Document = document): ChatWindow[] {
  const windows: ChatWindow[] = [];
  for (const overlay of doc.querySelectorAll<HTMLElement>(SITE_OVERLAY)) {
    const frame = overlay.querySelector<HTMLElement>(':scope > div.card-frame.flex-col');
    const header = frame?.querySelector<HTMLElement>(`:scope > ${HEADER}`);
    const peer = header && readHeader(header);
    if (frame && peer) {
      windows.push({
        overlay,
        frame,
        close: peer.close,
        peer: { name: peer.name, avatar: peer.avatar, username: peer.username },
        guild: frame.classList.contains(GUILD_CHAT_CLASS),
      });
    }
  }
  return windows;
}
