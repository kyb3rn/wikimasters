import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';
import { readSessionCookie, supabaseFetch, supabaseUserId, trackSupabaseSession } from '@/site/api';
import { connectFakeSite, fakeStorage } from '../../support';

const SB = 'https://projet.supabase.co';
const NAME = 'sb-projet-auth-token';

const jwt = (payload: object) => `entete.${Buffer.from(JSON.stringify(payload)).toString('base64url')}.signature`;
const TOKEN = jwt({ sub: 'u1' });
/** Session telle que l'écrit `@supabase/ssr` : `base64-` puis le JSON en base64url. */
const encoded = (session: object) => `base64-${Buffer.from(JSON.stringify(session)).toString('base64url')}`;

describe('readSessionCookie', () => {
  it('session en base64url, parmi d’autres cookies', () => {
    expect(readSessionCookie(`autre=1; ${NAME}=${encoded({ access_token: TOKEN, refresh_token: 'r' })}; x=2`, SB)).toBe(TOKEN);
  });

  it('découpée en morceaux .0, .1…, recollés dans l’ordre', () => {
    const value = encoded({ access_token: TOKEN });
    const cookies = `${NAME}.1=${value.slice(20)}; ${NAME}.0=${value.slice(0, 20)}`;
    expect(readSessionCookie(cookies, SB)).toBe(TOKEN);
  });

  it('forme ancienne : JSON en clair, encodé pour l’adresse', () => {
    expect(readSessionCookie(`${NAME}=${encodeURIComponent(JSON.stringify({ access_token: TOKEN }))}`, SB)).toBe(TOKEN);
  });

  it('absent, d’un autre projet ou illisible : rien', () => {
    expect(readSessionCookie('', SB)).toBeUndefined();
    expect(readSessionCookie(`sb-autre-auth-token=${encoded({ access_token: TOKEN })}`, SB)).toBeUndefined();
    expect(readSessionCookie(`${NAME}=base64-%%%`, SB)).toBeUndefined();
    expect(readSessionCookie(`${NAME}=${encoded({ refresh_token: 'r' })}`, SB)).toBeUndefined();
  });
});

describe('session sans requête Supabase du site', () => {
  let siteFetch: typeof fetch;
  let storage: ReturnType<typeof fakeStorage>;
  const sent: Headers[] = [];

  beforeAll(() => {
    siteFetch = connectFakeSite('https://www.wiki-masters.com/marketplace', (url, init) => {
      sent.push(new Headers(init?.headers));
      return url.hostname.endsWith('.supabase.co') ? Response.json([]) : undefined;
    });
    trackSupabaseSession();
  });

  afterEach(() => vi.unstubAllGlobals());

  function stubPage(cookie: string): void {
    vi.stubGlobal('localStorage', storage);
    vi.stubGlobal('document', { cookie });
  }

  it('clé jamais vue : introuvable, même avec le cookie', async () => {
    storage = fakeStorage();
    stubPage(`${NAME}=${encoded({ access_token: TOKEN })}`);
    expect(supabaseUserId()).toBeUndefined();
    await expect(supabaseFetch('/rest/v1/cards')).rejects.toThrow('Session du site introuvable');
  });

  it('clé gardée d’une visite précédente : jeton relu dans le cookie', async () => {
    storage = fakeStorage({ 'wm-supabase-v1': JSON.stringify({ origin: SB, apikey: 'cle' }) });
    stubPage(`${NAME}=${encoded({ access_token: TOKEN })}`);
    expect(supabaseUserId()).toBe('u1');
    await supabaseFetch('/rest/v1/cards');
    expect(sent.at(-1)?.get('apikey')).toBe('cle');
    expect(sent.at(-1)?.get('authorization')).toBe(`Bearer ${TOKEN}`);
  });

  it('cookie retiré (déconnexion) : introuvable', () => {
    stubPage('');
    expect(supabaseUserId()).toBeUndefined();
  });

  it('la clé d’une requête du site est gardée, sa session passe avant le cookie', async () => {
    storage = fakeStorage();
    stubPage(`${NAME}=${encoded({ access_token: TOKEN })}`);
    await siteFetch(`${SB}/rest/v1/profiles`, { headers: { apikey: 'nouvelle', authorization: `Bearer ${jwt({ sub: 'u2' })}` } });
    expect(JSON.parse(storage.data.get('wm-supabase-v1') ?? '')).toEqual({ origin: SB, apikey: 'nouvelle' });
    expect(supabaseUserId()).toBe('u2');
  });
});
