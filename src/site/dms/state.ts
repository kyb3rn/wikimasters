import { isRecord } from '@/core/guards';
import { currentFiberAncestors, stateHooks, type StateHook } from '@/core/react';
import type { Player } from '@/site/api';

/**
 * Conversations de /dms, telles que `GET /api/chat` les donne (capture du 29/09/2026) et que la page les garde dans
 * son état. La page ne les relit qu'à la fermeture de sa conversation, et son temps réel (`dms-list:<moi>`) ne voit
 * que les messages reçus : une conversation commencée ailleurs que par une ligne n'y apparaît pas d'elle-même.
 */
export interface DmsConversation {
  readonly peer_id: string;
  readonly peer_username: string;
  readonly peer_avatar_url: string | null;
  readonly peer_avatar_pos_x: number;
  readonly peer_avatar_pos_y: number;
  readonly last_message: string;
  readonly last_message_at: string;
  readonly unread_count: number;
}

const isConversation = (value: unknown): boolean =>
  isRecord(value) && typeof value.peer_id === 'string' && typeof value.peer_username === 'string';

const isConversationList = (hook: StateHook): hook is StateHook & { value: unknown[] } =>
  Array.isArray(hook.value) && hook.value.length > 0 && hook.value.every(isConversation);

/**
 * État des conversations, au-dessus d'une ligne de la liste. Une liste vide ne se distingue pas des autres états
 * vides de la page : sans conversation affichée, il est introuvable.
 */
function conversationsState(row: Element): (StateHook & { value: unknown[] }) | undefined {
  for (const fiber of currentFiberAncestors(row)) {
    const hook = stateHooks(fiber).find(isConversationList);
    if (hook) return hook;
  }
  return undefined;
}

/** Conversation avec ce joueur, telle que la page la garderait après son premier message. */
export function newDmsConversation(peer: Player, message: { readonly content: string; readonly createdAt: string }): DmsConversation {
  return {
    peer_id: peer.id,
    peer_username: peer.username,
    peer_avatar_url: peer.avatarUrl ?? null,
    peer_avatar_pos_x: peer.avatarPosX,
    peer_avatar_pos_y: peer.avatarPosY,
    last_message: message.content,
    last_message_at: message.createdAt,
    unread_count: 0,
  };
}

/**
 * Ajoute une conversation en tête de la liste de la page (la plus récente), depuis une de ses lignes ; rien si elle y
 * est déjà. Faux si l'état de la page est illisible.
 */
export function addDmsConversation(row: Element, conversation: DmsConversation): boolean {
  const state = conversationsState(row);
  if (!state) return false;
  if (!state.value.some((item) => isRecord(item) && item.peer_id === conversation.peer_id)) state.set([conversation, ...state.value]);
  return true;
}
