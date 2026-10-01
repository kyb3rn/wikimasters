import { isRecord, parseJson } from '@/core/guards';
import { net, type NetRequest } from '@/core/net';
import { NETWORK_ERROR, SiteApiError } from './errors';

/**
 * Base Supabase du site (`https://<projet>.supabase.co`), appelée directement par son client : étiquettes,
 * favoris, profils… Chaque requête porte la clé publique (`apikey`) et le jeton de la session
 * (`Authorization: Bearer …`, valable une heure, renouvelé par le client du site par `POST /auth/v1/token`).
 * On reprend ceux de sa dernière requête, et le jeton de chaque renouvellement.
 */
interface Session {
  readonly origin: string;
  readonly apikey: string;
  readonly authorization: string;
}

let session: Session | undefined;

const isSupabase = (request: NetRequest) => request.url.hostname.endsWith('.supabase.co') && !request.own;

/** Suit la session Supabase du site, pour toute la vie du script (appelé une fois, au démarrage). */
export function trackSupabaseSession(): void {
  net.track(isSupabase, (request) => {
    const apikey = request.headers.get('apikey');
    const authorization = request.headers.get('authorization');
    if (apikey && authorization?.startsWith('Bearer ')) session = { origin: request.url.origin, apikey, authorization };
  });
  net.observe(
    (request) => isSupabase(request) && request.url.pathname === '/auth/v1/token',
    async (exchange) => {
      if (!exchange.ok || !session) return;
      const body = await exchange.json().catch(() => undefined);
      if (isRecord(body) && typeof body.access_token === 'string') session = { ...session, authorization: `Bearer ${body.access_token}` };
    },
  );
}

/** Utilisateur de la session (`sub` du jeton), s'il est lisible. */
export function supabaseUserId(): string | undefined {
  const payload = session?.authorization.slice('Bearer '.length).split('.')[1];
  if (!payload) return undefined;
  let json: unknown;
  try {
    json = parseJson(atob(payload.replace(/-/g, '+').replace(/_/g, '/')));
  } catch {
    // Pas du base64.
    return undefined;
  }
  return isRecord(json) && typeof json.sub === 'string' ? json.sub : undefined;
}

/**
 * De quoi ouvrir le temps réel de Supabase avec la session du site : adresse de sa WebSocket (celle du site, clé
 * publique comprise) et jeton de la session, renouvelé avec elle.
 */
export function supabaseRealtimeAccess(): { readonly url: string; readonly token: string } | undefined {
  if (!session) return undefined;
  const url = `${session.origin.replace(/^http/, 'ws')}/realtime/v1/websocket?apikey=${encodeURIComponent(session.apikey)}&vsn=2.0.0`;
  return { url, token: session.authorization.slice('Bearer '.length) };
}

/**
 * Appel brut de Supabase avec la session du site, par `net.fetch` : la réponse telle quelle, quel que soit
 * son statut (en-têtes compris, comme le `Content-Range` d'un comptage). Erreur seulement sans session
 * ou sans réseau.
 */
export async function supabaseFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const current = session;
  if (!current) throw new SiteApiError('Session du site introuvable : rechargez la page.', 0);
  const headers = new Headers(init.headers);
  headers.set('apikey', current.apikey);
  headers.set('authorization', current.authorization);
  if (init.body !== undefined) headers.set('content-type', 'application/json');
  try {
    return await net.fetch(current.origin + path, { ...init, headers });
  } catch {
    throw new SiteApiError(NETWORK_ERROR, 0);
  }
}

/**
 * Appel de l'API REST de Supabase (`/rest/v1/…`) avec la session du site, par `net.fetch`. Une seule
 * tentative. `failure` : le message montré si le serveur refuse, sans point final (les siens sont techniques, en
 * anglais) ; le code Postgres (`23505` : doublon) reste dans `SiteApiError.code`.
 */
export async function supabaseRequest<T>(
  path: string,
  init: RequestInit,
  failure: string,
  parse: (raw: unknown) => T | undefined,
): Promise<T> {
  const response = await supabaseFetch(path, init);
  const text = await response.text().catch(() => '');
  const body = text ? parseJson(text) : undefined;
  if (!response.ok) {
    const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
    const message = response.status === 401 ? 'Session expirée : rechargez la page.' : `${failure} (erreur ${response.status}).`;
    throw new SiteApiError(message, response.status, code);
  }
  const value = parse(body);
  if (value === undefined) throw new SiteApiError('Réponse inattendue du site.', response.status);
  return value;
}

/**
 * Profil du joueur connecté demandé par le site à Supabase (`rpc/get_my_profile`, `rpc/sync_profile_packs` :
 * `{ id, username, is_pro, … }`).
 */
export function isMyProfileRpc(request: NetRequest): boolean {
  return request.method === 'POST' && /\/rest\/v1\/rpc\/(?:get_my_profile|sync_profile_packs)$/.test(request.url.pathname);
}
