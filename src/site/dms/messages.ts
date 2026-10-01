import { isRecord } from '@/core/guards';
import { fiberOf, findPropsAbove, stateHooks } from '@/core/react';
import { textOf } from '@/core/text';

/**
 * Messages d'une conversation (code du site du 29/09/2026 et du 01/10/2026 pour le chat de guilde) : messages et
 * autres éléments (échanges, annonces de la guilde) triés par date, groupés par jour.
 *
 *   div.flex-1.overflow-y-auto (liste)
 *     div (un jour)
 *       div.flex.items-center.my-3 (séparateur « 19 sept. »)
 *       div.flex.justify-center (échange, annonce de la guilde)
 *       div.group.mb-1.5 (message, clé React = id du message)
 *         div.mb-0.5.flex.gap-2 (chat de guilde, messages des autres : pseudo, derrière une cale `h-8 w-8`)
 *         div.flex.items-end.flex-row (d'un autre) | .flex-row-reverse (de soi)
 *           div.rounded-full (photo de l'auteur, `h-8 w-8` ; absente sur ses propres messages)
 *           div.rounded-2xl (bulle)
 *         div.mt-0.5 (heure « 02:17 » au survol)
 *
 * L'heure affichée n'a que la minute : la date exacte (`created_at`) est lue dans l'état React de la conversation
 * (liste des messages, tenue à jour par le site : envoi, temps réel). La conversation de guilde du script, au même
 * balisage, la porte sur chaque ligne (`data-wm-*` : id, date, auteur et son pseudo).
 */
export interface ChatMessage {
  readonly kind: 'message';
  readonly row: HTMLElement;
  /** Rangée de la photo et de la bulle. */
  readonly line: HTMLElement;
  readonly bubble: HTMLElement;
  /** Photo de l'auteur, à côté de chacun de ses messages (pas des siens). */
  readonly avatar: HTMLElement | undefined;
  /** Rangée du pseudo de l'auteur, au-dessus (chat de groupe). */
  readonly nameRow: HTMLElement | undefined;
  /** Rangée de l'heure, sous la bulle. */
  readonly timeRow: HTMLElement | undefined;
  /** « 02:17 ». */
  readonly time: string;
  readonly own: boolean;
  readonly id: string | undefined;
  /** Auteur : son id s'il est connu, sinon `me` ou `peer` (conversation à deux). */
  readonly sender: string;
  /** Pseudo de l'auteur, s'il est donné (conversation de guilde). */
  readonly senderName: string | undefined;
  /** Date d'envoi (ms), si la ligne la porte. */
  readonly at: number | undefined;
}

/** Échange, annonce : coupe les groupes de messages. */
export interface ChatOther {
  readonly kind: 'other';
  readonly row: HTMLElement;
}

export type ChatEntry = ChatMessage | ChatOther;

/** Attributs des lignes de la conversation de guilde du script. */
export const CHAT_ROW_DATA = { id: 'data-wm-id', at: 'data-wm-at', sender: 'data-wm-sender', name: 'data-wm-name' } as const;

/** Liste des messages d'une conversation (dans son cadre). */
export function findChatList(frame: HTMLElement): HTMLElement | undefined {
  return frame.querySelector<HTMLElement>(':scope > div.flex-1.overflow-y-auto') ?? undefined;
}

function readMessage(row: HTMLElement): ChatMessage | undefined {
  const line = row.querySelector<HTMLElement>(':scope > div.flex.items-end');
  const bubble = line?.querySelector<HTMLElement>(':scope > div.rounded-2xl');
  if (!line || !bubble) return undefined;
  const timeRow = row.querySelector<HTMLElement>(':scope > div.mt-0\\.5') ?? undefined;
  const key = fiberOf(row)?.key;
  const own = line.classList.contains('flex-row-reverse');
  const at = Number(row.getAttribute(CHAT_ROW_DATA.at) ?? NaN);
  return {
    kind: 'message',
    row,
    line,
    bubble,
    avatar: line.querySelector<HTMLElement>(':scope > div.rounded-full') ?? undefined,
    nameRow: row.querySelector<HTMLElement>(':scope > div.mb-0\\.5') ?? undefined,
    timeRow,
    time: textOf(timeRow?.querySelector(':scope > span')),
    own,
    id: typeof key === 'string' ? key : (row.getAttribute(CHAT_ROW_DATA.id) ?? undefined),
    sender: row.getAttribute(CHAT_ROW_DATA.sender) ?? (own ? 'me' : 'peer'),
    senderName: row.getAttribute(CHAT_ROW_DATA.name) ?? undefined,
    at: Number.isFinite(at) ? at : undefined,
  };
}

/** Messages et autres éléments de la liste, jour par jour, dans l'ordre affiché. */
export function readChatDays(list: HTMLElement): ChatEntry[][] {
  const days: ChatEntry[][] = [];
  for (const day of list.querySelectorAll<HTMLElement>(':scope > div:has(> div.my-3:first-child)')) {
    const entries: ChatEntry[] = [];
    for (const row of day.querySelectorAll<HTMLElement>(':scope > div')) {
      if (row.classList.contains('group')) {
        const message = readMessage(row);
        if (message) entries.push(message);
      } else if (row.classList.contains('justify-center')) {
        entries.push({ kind: 'other', row });
      }
    }
    days.push(entries);
  }
  return days;
}

/** Date d'envoi (ms) de chaque message de la conversation, par id, lue dans son état React. */
export function readChatMessageDates(list: HTMLElement): Map<string, number> {
  const dates = new Map<string, number>();
  const chat = findPropsAbove(list, (props) => 'peer' in props && 'currentUserId' in props);
  for (const { value } of chat ? stateHooks(chat.fiber) : []) {
    if (!Array.isArray(value)) continue;
    for (const message of value) {
      if (!isRecord(message) || typeof message.id !== 'string' || !('content' in message)) continue;
      const at = typeof message.created_at === 'string' ? Date.parse(message.created_at) : NaN;
      if (Number.isFinite(at)) dates.set(message.id, at);
    }
  }
  return dates;
}
