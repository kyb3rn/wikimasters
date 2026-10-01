import { beforeAll, describe, expect, it } from 'vitest';
import { net } from '@/core/net';
import { isMyProfileRpc, supabaseRealtimeAccess, supabaseUserId, trackSupabaseSession } from '@/site/api';
import { connectFakeSite, flush, netRequest } from '../../support';

const SB = 'https://x.supabase.co';

/** Jeton de session : seule sa partie centrale (base64url, sans remplissage) est lue. */
const jwt = (payload: object) => `entete.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;

/** Requête Supabase du site, avec sa clé et son jeton. */
const withSession = (token: string) => ({ headers: { apikey: 'cle', authorization: `Bearer ${token}` } });

let siteFetch: typeof fetch;
let renewed = '';

beforeAll(() => {
  siteFetch = connectFakeSite('https://www.wiki-masters.com/collection', (url) =>
    url.pathname === '/auth/v1/token' ? Response.json({ access_token: renewed }) : Response.json([]),
  );
  trackSupabaseSession();
});

describe('session Supabase du site', () => {
  it('aucune tant que le site n’a rien demandé à Supabase', () => {
    expect(supabaseUserId()).toBeUndefined();
    expect(supabaseRealtimeAccess()).toBeUndefined();
  });

  it('utilisateur lu dans le jeton de la dernière requête du site, dès son départ', async () => {
    const pending = siteFetch(`${SB}/rest/v1/profiles?id=eq.u1`, withSession(jwt({ sub: 'u1', role: 'authenticated' })));
    expect(supabaseUserId()).toBe('u1');
    await pending;
    expect(supabaseRealtimeAccess()).toEqual({
      url: 'wss://x.supabase.co/realtime/v1/websocket?apikey=cle&vsn=2.0.0',
      token: jwt({ sub: 'u1', role: 'authenticated' }),
    });
  });

  it('jeton renouvelé par le site : repris de la réponse', async () => {
    // « ?> » s'écrit avec « _ » en base64url.
    renewed = jwt({ sub: 'joueur?>' });
    await siteFetch(`${SB}/auth/v1/token?grant_type=refresh_token`, { method: 'POST', ...withSession(jwt({ sub: 'u1' })) });
    await flush();
    await flush();
    expect(supabaseUserId()).toBe('joueur?>');
  });

  it('pas les requêtes du script', async () => {
    await net.fetch(`${SB}/rest/v1/cards`, withSession(jwt({ sub: 'autre' })));
    expect(supabaseUserId()).toBe('joueur?>');
  });

  it('jeton illisible ou sans `sub` : inconnu', async () => {
    await siteFetch(`${SB}/rest/v1/cards`, withSession('pas.un-jeton!.x'));
    expect(supabaseUserId()).toBeUndefined();
    await siteFetch(`${SB}/rest/v1/cards`, withSession(jwt({ role: 'anon' })));
    expect(supabaseUserId()).toBeUndefined();
  });
});

describe('isMyProfileRpc', () => {
  it('profil du joueur connecté demandé à Supabase (deux RPC), pas les autres', () => {
    const rpc = (name: string, method = 'POST') => netRequest(`${SB}/rest/v1/rpc/${name}`, { method });
    expect(isMyProfileRpc(rpc('get_my_profile'))).toBe(true);
    expect(isMyProfileRpc(rpc('sync_profile_packs'))).toBe(true);
    expect(isMyProfileRpc(rpc('get_my_profile', 'GET'))).toBe(false);
    expect(isMyProfileRpc(rpc('get_my_profile_x'))).toBe(false);
  });
});
