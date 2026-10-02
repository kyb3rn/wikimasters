import { isRecord } from '@/core/guards';
import { siteRequest } from './request';

/**
 * Création d'une guilde (code du site du 01/10/2026) : `POST /api/guilds` `{ name, description? }`, nom de 2 à
 * 30 caractères, description de 200 au plus (vide : absente). Refus : `{ error }`, que le site affiche tel quel.
 */
export const GUILD_NAME_MIN = 2;
export const GUILD_NAME_MAX = 30;
export const GUILD_DESCRIPTION_MAX = 200;

export async function createGuild(name: string, description: string): Promise<void> {
  await siteRequest(
    '/api/guilds',
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, description: description || undefined }),
    },
    (raw) => (isRecord(raw) ? true : undefined),
  );
}
