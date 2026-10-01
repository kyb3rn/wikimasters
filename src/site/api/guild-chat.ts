import { isRecord } from '@/core/guards';
import { parsePlayer, type Player } from './friends';
import { siteRequest } from './request';
import { supabaseRequest } from './supabase';

/**
 * Chat de guilde (code du site du 01/10/2026) : `GET /api/guilds/chat` (`{ messages }`, triés, avec leur auteur),
 * `POST /api/guilds/chat` `{ content }` (`{ message }`, 1 000 caractères au plus). Les messages `type: 'event'` sont
 * les annonces de la guilde (« X a rejoint la guilde. Dites bonjour ! »), sans auteur affiché. Les nouveaux arrivent
 * par le temps réel (`guild-chat:<guilde>`, INSERT de `guild_messages`) sans leur auteur : le site le reprend de sa
 * liste des membres.
 */
export interface GuildMessage {
  readonly id: string;
  readonly senderId: string | null;
  readonly content: string;
  /** `message`, ou `event` (annonce). */
  readonly type: string;
  readonly createdAt: string;
  readonly sender: Player | undefined;
}

export const GUILD_MESSAGE_MAX_LENGTH = 1000;

/** Auteur joint à un message : objet, ou liste d'un objet (jointure de Supabase). */
const parseSender = (raw: unknown): Player | undefined => parsePlayer(Array.isArray(raw) ? (raw as unknown[])[0] : raw);

/** Message de l'API ou ligne de `guild_messages` reçue par le temps réel. */
export function parseGuildMessage(raw: unknown): GuildMessage | undefined {
  if (!isRecord(raw) || typeof raw.id !== 'string' || typeof raw.content !== 'string' || typeof raw.created_at !== 'string') return undefined;
  if (!Number.isFinite(Date.parse(raw.created_at))) return undefined;
  return {
    id: raw.id,
    senderId: typeof raw.sender_id === 'string' ? raw.sender_id : null,
    content: raw.content,
    type: typeof raw.type === 'string' ? raw.type : 'message',
    createdAt: raw.created_at,
    sender: parseSender(raw.sender),
  };
}

const parseMessages = (raw: unknown): GuildMessage[] | undefined =>
  isRecord(raw) && Array.isArray(raw.messages) ? raw.messages.flatMap((item) => parseGuildMessage(item) ?? []) : undefined;

export function fetchGuildChat(): Promise<GuildMessage[]> {
  return siteRequest('/api/guilds/chat', { cache: 'no-store' }, parseMessages);
}

export function sendGuildMessage(content: string): Promise<GuildMessage> {
  return siteRequest(
    '/api/guilds/chat',
    { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ content }) },
    (raw) => (isRecord(raw) ? parseGuildMessage(raw.message) : undefined),
  );
}

/** Auteur d'un message reçu par le temps réel, inconnu jusque-là (colonnes utiles seulement). */
export async function fetchGuildSender(id: string): Promise<Player | undefined> {
  const path = `/rest/v1/profiles?select=id,username,avatar_url,avatar_pos_x,avatar_pos_y&id=eq.${encodeURIComponent(id)}`;
  const [sender] = await supabaseRequest(path, {}, 'Profil illisible', (raw) => (Array.isArray(raw) ? [parsePlayer(raw[0])] : undefined));
  return sender;
}
