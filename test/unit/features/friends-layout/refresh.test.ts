import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { serveFriendsRefresh } from '@/features/friends-layout/refresh';
import { NETWORK_ERROR, type FriendsData } from '@/site/api';
import { connectFakeSite, flush, friendship, memoryLogger } from '../../support';

/** États de la page Amis affichés ; `undefined` : illisibles. */
const page = vi.hoisted((): { data: FriendsData | undefined } => ({ data: undefined }));
vi.mock('@/site/friends', async (original) => ({
  ...(await original<object>()),
  findFriendsPage: () => ({ list: { section: {} } }),
  readFriendsData: () => page.data,
}));

const DATA: FriendsData = {
  friendships: [
    friendship('f1', 'accepted', 'me', 'u1'),
    friendship('r1', 'pending', 'u7', 'me'),
    friendship('r2', 'pending', 'u8', 'me'),
  ],
  counts: { accepted: 1, incoming: 2, outgoing: 0 },
};

/** Réponses du faux site aux actions, par « méthode chemin » ; absente : pas de réponse. */
const replies = new Map<string, () => Response>();
let siteFetch: typeof fetch;
/** Relectures de la liste parties au réseau. */
let networkReads = 0;

beforeAll(() => {
  siteFetch = connectFakeSite('https://www.wiki-masters.com/friends', (url, init) => {
    const key = `${init?.method ?? 'GET'} ${url.pathname}`;
    if (key === 'GET /api/friends') {
      networkReads++;
      return Response.json({ réseau: true });
    }
    return replies.get(key)?.();
  });
});

let controller: AbortController;
let ends: [string, number | undefined][];
let refusals: string[];
let log: ReturnType<typeof memoryLogger>;

beforeEach(() => {
  page.data = DATA;
  replies.clear();
  networkReads = 0;
  controller = new AbortController();
  ends = [];
  refusals = [];
  log = memoryLogger();
  serveFriendsRefresh({
    signal: controller.signal,
    log,
    onActionEnd: (action, status) => ends.push([action.kind, status]),
    onRefused: (message) => refusals.push(message),
  });
});
afterEach(() => controller.abort());

const json = (body: unknown) => JSON.stringify(body);
const answer = (path: string, action: string) => siteFetch(path, { method: 'PATCH', body: json({ action }) });
/** Relecture de la liste par le site, après son action. */
const reread = async () => (await siteFetch('/api/friends')).json() as Promise<FriendsData & { réseau?: true }>;
const statuses = (data: FriendsData) => data.friendships.map((f) => `${f.id}:${f.status}`);

describe('relecture de la page Amis après une action', () => {
  it('demande acceptée : relecture servie sans réseau, avec l’état affiché et le changement', async () => {
    replies.set('PATCH /api/friends/r1', () => Response.json({ success: true }));
    await answer('/api/friends/r1', 'accept');
    const served = await reread();
    expect(statuses(served)).toEqual(['f1:accepted', 'r1:accepted', 'r2:pending']);
    expect(served.counts).toEqual({ accepted: 2, incoming: 1, outgoing: 0 });
    expect(networkReads).toBe(0);
    expect(ends).toEqual([['accept', 200]]);
  });

  it('chargement de la page, sans action : au réseau', async () => {
    expect((await reread()).réseau).toBe(true);
    expect(networkReads).toBe(1);
  });

  it('deux actions de suite : la seconde relecture rejoue la première (pas encore rendue par React)', async () => {
    replies.set('PATCH /api/friends/r1', () => Response.json({ success: true }));
    replies.set('PATCH /api/friends/r2', () => Response.json({ success: true }));
    await answer('/api/friends/r1', 'accept');
    await reread();
    await answer('/api/friends/r2', 'decline');
    const served = await reread();
    expect(statuses(served)).toEqual(['f1:accepted', 'r1:accepted']);
    expect(served.counts).toEqual({ accepted: 2, incoming: 0, outgoing: 0 });
  });

  it('action refusée : relecture servie telle quelle, refus signalé', async () => {
    replies.set('PATCH /api/friends/r1', () => Response.json({ error: 'Demande expirée' }, { status: 409 }));
    await answer('/api/friends/r1', 'accept');
    expect(await reread()).toEqual(DATA);
    await flush();
    await flush();
    expect(refusals).toEqual(['Demande expirée']);
    expect(ends).toEqual([['accept', 409]]);
  });

  it('action sans réponse : le site ne relit pas ; la relecture suivante va au réseau', async () => {
    await siteFetch('/api/friends/f1', { method: 'DELETE' }).catch(() => undefined);
    expect(ends).toEqual([['delete', undefined]]);
    expect(refusals).toEqual([NETWORK_ERROR]);
    expect((await reread()).réseau).toBe(true);
  });

  it('demande envoyée : son destinataire repris de la recherche de joueurs', async () => {
    replies.set('GET /api/friends/search', () => Response.json({ users: [{ id: 'u10', username: 'Zoé', avatar_url: null }] }));
    replies.set('POST /api/friends', () =>
      Response.json({ friendship: { id: 's1', status: 'pending', requester_id: 'me', addressee_id: 'u10' } }, { status: 201 }),
    );
    await siteFetch('/api/friends/search?q=zo');
    await flush();
    await flush();
    await siteFetch('/api/friends', { method: 'POST', body: json({ addressee_id: 'u10' }) });
    const served = await reread();
    expect(served.friendships.at(-1)).toEqual({
      id: 's1',
      status: 'pending',
      requester_id: 'me',
      addressee_id: 'u10',
      addressee: { id: 'u10', username: 'Zoé', avatar_url: null },
    });
    expect(served.counts).toEqual({ accepted: 1, incoming: 2, outgoing: 1 });
  });

  it('changement inconnu ou état de la page illisible : relecture laissée au réseau', async () => {
    // Réponse de la demande illisible : le destinataire n'est pas connu.
    replies.set('POST /api/friends', () => Response.json({ ok: true }, { status: 201 }));
    await siteFetch('/api/friends', { method: 'POST', body: json({ addressee_id: 'u11' }) });
    expect((await reread()).réseau).toBe(true);

    page.data = undefined;
    replies.set('PATCH /api/friends/r1', () => Response.json({ success: true }));
    await answer('/api/friends/r1', 'accept');
    expect((await reread()).réseau).toBe(true);
    expect(log.warnings).toHaveLength(2);
  });
});
