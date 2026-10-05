import { isRecord } from '@/core/guards';
import type { NetRequest } from '@/core/net';

const CHAT = /^\/api\/chat\/([^/]+)$/;

/** Message envoyé dans une conversation privée : `POST /api/chat/<peerId>` `{ content }`. */
export function isChatMessageSend(request: NetRequest): boolean {
  return request.method === 'POST' && CHAT.test(request.url.pathname);
}

export interface SentChatMessage {
  readonly recipientId: string;
  readonly content: string;
  readonly createdAt: string;
}

/**
 * Réponse de `POST /api/chat/<peerId>` (capture du 29/09/2026) : `{ message: { id, sender_id, recipient_id, content,
 * read, created_at, sender } }`, l'auteur (soi) joint, pas le destinataire.
 */
export function parseSentChatMessage(body: unknown): SentChatMessage | undefined {
  const message = isRecord(body) ? body.message : undefined;
  if (!isRecord(message)) return undefined;
  const { recipient_id: recipientId, content, created_at: createdAt } = message;
  return typeof recipientId === 'string' && typeof content === 'string' && typeof createdAt === 'string'
    ? { recipientId, content, createdAt }
    : undefined;
}
