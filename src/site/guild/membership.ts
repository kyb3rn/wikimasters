import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import { jsonStore } from '@/core/storage';
import { supabaseRequest, supabaseUserId } from '@/site/api';

/**
 * Guilde du joueur connecté (id, nom), ou `null` sans guilde. Le site ne la demande que sur /guild
 * (`GET /api/guilds` : `{ guild, membership, … }`, `guild` nul sans guilde) : le script lit cette réponse et le départ
 * (`POST /api/guilds/leave`) à chaque fois. Ailleurs, s'il ne la connaît pas ou que sa dernière vérification a plus de
 * 4 heures (demande de l'utilisateur), il la lit dans Supabase en deux requêtes légères (`guild_members`, `guilds`).
 */
export interface MyGuild {
  readonly id: string;
  readonly name: string;
}

interface Stored {
  readonly userId: string;
  readonly guild: MyGuild | null;
  readonly checkedAt: number;
}

export const GUILD_CHECK_MS = 4 * 60 * 60 * 1000;

const parseGuild = (raw: unknown): MyGuild | undefined =>
  isRecord(raw) && typeof raw.id === 'string' && typeof raw.name === 'string' ? { id: raw.id, name: raw.name } : undefined;

const parseStored = (raw: unknown): Stored | undefined => {
  if (!isRecord(raw) || typeof raw.userId !== 'string' || typeof raw.checkedAt !== 'number') return undefined;
  const guild = raw.guild === null ? null : parseGuild(raw.guild);
  return guild === undefined ? undefined : { userId: raw.userId, guild, checkedAt: raw.checkedAt };
};

const store = jsonStore<Stored | undefined>('wm-guild-v1', undefined, parseStored);
let tracking = false;
let pending: Promise<MyGuild | null | undefined> | undefined;

function remember(userId: string, guild: MyGuild | null): void {
  store.set({ userId, guild, checkedAt: Date.now() });
}

/** Guilde de la réponse de `GET /api/guilds` (`null` sans guilde), si elle se lit. */
export function readGuildsResponse(body: unknown): MyGuild | null | undefined {
  if (!isRecord(body) || !('guild' in body)) return undefined;
  return body.guild === null ? null : parseGuild(body.guild);
}

/** Suit la guilde du joueur dans les réponses du site, pour toute la vie du script (appelé une fois, au démarrage). */
export function trackGuildMembership(): void {
  if (tracking) return;
  tracking = true;
  net.observe(
    (request) => !request.own && request.url.pathname === '/api/guilds' && request.method === 'GET',
    async (exchange) => {
      const userId = supabaseUserId();
      if (!exchange.ok || !userId) return;
      const guild = readGuildsResponse(await exchange.json().catch(() => undefined));
      if (guild !== undefined) remember(userId, guild);
    },
  );
  net.observe(
    (request) => request.url.pathname === '/api/guilds/leave' && request.method === 'POST',
    (exchange) => {
      const userId = supabaseUserId();
      if (exchange.ok && userId) remember(userId, null);
    },
  );
}

/** Oublie la guilde retenue : la prochaine lecture la vérifie (le site a refusé son chat, par exemple). */
export function forgetMyGuild(): void {
  store.set(undefined);
}

async function lookUp(userId: string): Promise<MyGuild | null> {
  const id = encodeURIComponent(userId);
  const rows = await supabaseRequest(`/rest/v1/guild_members?select=guild_id&user_id=eq.${id}&limit=1`, {}, 'Guilde illisible', (raw) =>
    Array.isArray(raw) ? raw : undefined,
  );
  const first: unknown = rows[0];
  if (!isRecord(first) || typeof first.guild_id !== 'string') return null;
  const guildId = first.guild_id;
  const guilds = await supabaseRequest(`/rest/v1/guilds?select=id,name&id=eq.${encodeURIComponent(guildId)}`, {}, 'Guilde illisible', (raw) =>
    Array.isArray(raw) ? raw : undefined,
  );
  return parseGuild(guilds[0]) ?? { id: guildId, name: 'Guilde' };
}

/**
 * Guilde du joueur : celle retenue si elle a moins de 4 heures, sinon lue dans Supabase. `undefined` : inconnue
 * (session du site pas encore vue, lecture en échec).
 */
export function myGuild(now = Date.now()): Promise<MyGuild | null | undefined> {
  const userId = supabaseUserId();
  if (!userId) return Promise.resolve(undefined);
  const stored = store.get();
  if (stored && stored.userId === userId && now - stored.checkedAt >= 0 && now - stored.checkedAt < GUILD_CHECK_MS) {
    return Promise.resolve(stored.guild);
  }
  pending ??= lookUp(userId)
    .then((guild) => {
      remember(userId, guild);
      return guild;
    })
    .catch(() => undefined)
    .finally(() => {
      pending = undefined;
    });
  return pending;
}
