import { SITE_OVERLAY } from '@/site/modals';

/**
 * Conversation privée ouverte depuis `/dms` (captures du 29/09/2026) : modale du site (portail dans `body`),
 * feuille en bas sur mobile. En-tête :
 *
 *   div.flex.items-center.gap-3.border-b
 *     div.rounded-full (photo : `img[alt=pseudo]`, sinon initiales en `span`)
 *     div.flex-1.min-w-0 > p.font-semibold (pseudo, `peer_username` de `/api/chat`)
 *     button « Fermer »
 */
export interface ChatPeer {
  /** `p` du pseudo, rendu par le site. */
  readonly name: HTMLElement;
  /** Rond de la photo (ou des initiales). */
  readonly avatar: HTMLElement;
  readonly username: string;
}

/** Interlocuteur de chaque conversation ouverte. */
export function findChatPeers(doc: Document = document): ChatPeer[] {
  const peers: ChatPeer[] = [];
  for (const header of doc.querySelectorAll<HTMLElement>(`${SITE_OVERLAY} div.flex.items-center.gap-3.border-b`)) {
    const avatar = header.querySelector<HTMLElement>(':scope > div.rounded-full:first-child');
    const name = header.querySelector<HTMLElement>(':scope > div.flex-1.min-w-0 > p.font-semibold');
    const username = (name?.textContent ?? '').trim();
    if (avatar && name && username !== '' && header.querySelector(':scope > button[aria-label="Fermer"]')) {
      peers.push({ name, avatar, username });
    }
  }
  return peers;
}
