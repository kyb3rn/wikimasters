import { describe, expect, it } from 'vitest';
import {
  fetchFriendships,
  friendOf,
  isFriendsList,
  isFriendshipDelete,
  isPlayerSearch,
  parseFriendships,
  parsePlayer,
  parsePlayerSearch,
  parseSentFriendship,
  readFriendshipAction,
} from '@/site/api';
import { connectFakeSite, netRequest } from '../../support';

const request = (url: string, method = 'GET', body?: unknown) => netRequest(url, { method, body });

describe('requêtes des amis', () => {
  it('reconnaît le retrait d’une amitié, pas l’acceptation ni les autres routes', () => {
    expect(isFriendshipDelete(request('/api/friends/f1', 'DELETE'))).toBe(true);
    expect(isFriendshipDelete(request('/api/friends/f1', 'PATCH'))).toBe(false);
    expect(isFriendshipDelete(request('/api/friends/accept-all', 'POST'))).toBe(false);
    expect(isFriendshipDelete(request('/api/friends', 'DELETE'))).toBe(false);
  });

  it('reconnaît la relecture de la liste, pas la recherche de joueurs', () => {
    expect(isFriendsList(request('/api/friends'))).toBe(true);
    expect(isFriendsList(request('/api/friends/search?q=al'))).toBe(false);
    expect(isFriendsList(request('/api/friends', 'POST'))).toBe(false);
  });

  it('lit l’action de la page dans sa requête', () => {
    expect(readFriendshipAction(request('/api/friends/f1', 'PATCH', { action: 'accept' }))).toEqual({ kind: 'accept', id: 'f1' });
    expect(readFriendshipAction(request('/api/friends/f1', 'PATCH', { action: 'decline' }))).toEqual({ kind: 'decline', id: 'f1' });
    expect(readFriendshipAction(request('/api/friends/f1', 'DELETE'))).toEqual({ kind: 'delete', id: 'f1' });
    expect(readFriendshipAction(request('/api/friends/accept-all', 'POST'))).toEqual({ kind: 'accept-all' });
    expect(readFriendshipAction(request('/api/friends', 'POST', { addressee_id: 'u9' }))).toEqual({ kind: 'add', addresseeId: 'u9' });
    expect(readFriendshipAction(request('/api/friends/f1', 'PATCH', { action: 'block' }))).toBeUndefined();
    expect(readFriendshipAction(request('/api/friends'))).toBeUndefined();
    expect(readFriendshipAction(request('/api/friends/search?q=al'))).toBeUndefined();
  });

  it('lit l’amitié créée par une demande envoyée', () => {
    expect(parseSentFriendship({ friendship: { id: 's1', status: 'pending', addressee_id: 'u9' } })).toEqual({
      id: 's1',
      status: 'pending',
      addressee_id: 'u9',
    });
    expect(parseSentFriendship({ error: 'Déjà amis' })).toBeUndefined();
  });
});

describe('joueurs et amitiés lus dans les réponses', () => {
  it('joueur : photo et cadrage (50 % par défaut), pseudo et id requis', () => {
    expect(parsePlayer({ id: 'u1', username: 'Aline', avatar_url: 'https://x/a.png', avatar_pos_x: 20, avatar_pos_y: 80, extra: 1 })).toEqual({
      id: 'u1',
      username: 'Aline',
      avatarUrl: 'https://x/a.png',
      avatarPosX: 20,
      avatarPosY: 80,
    });
    expect(parsePlayer({ id: 'u1', username: 'Aline', avatar_url: '', avatar_pos_x: null })).toEqual({
      id: 'u1',
      username: 'Aline',
      avatarUrl: undefined,
      avatarPosX: 50,
      avatarPosY: 50,
    });
    expect(parsePlayer({ id: 'u1' })).toBeUndefined();
    expect(parsePlayer([{ id: 'u1', username: 'Aline' }])).toBeUndefined();
  });

  it('amitiés de GET /api/friends : les illisibles écartées ; l’autre joueur de chacune', () => {
    const body = {
      friendships: [
        { id: 'f1', status: 'accepted', requester_id: 'me', addressee_id: 'a', requester: { id: 'me' }, addressee: { id: 'a' } },
        { id: 'f2', status: 'pending', requester_id: 'b', addressee_id: 'me', requester: { id: 'b' }, addressee: { id: 'me' } },
        { status: 'accepted' },
      ],
      counts: { accepted: 1, incoming: 1, outgoing: 0 },
    };
    const [first, second, third] = parseFriendships(body);
    expect(third).toBeUndefined();
    expect(first && friendOf(first, 'me')).toEqual({ id: 'a', player: { id: 'a' } });
    expect(second && friendOf(second, 'me')).toEqual({ id: 'b', player: { id: 'b' } });
    expect(parseFriendships({ error: 'x' })).toEqual([]);
  });

  it('recherche de joueurs : ceux qui ont un id, gardés tels quels', () => {
    expect(isPlayerSearch(request('/api/friends/search?q=al'))).toBe(true);
    expect(isPlayerSearch(request('/api/friends'))).toBe(false);
    const aline = { id: 'u1', username: 'Aline', avatar_url: null };
    expect(parsePlayerSearch({ users: [aline, { username: 'sans id' }, 'x'] })).toEqual([aline]);
    expect(parsePlayerSearch({ error: 'x' })).toEqual([]);
  });
});

describe('fetchFriendships', () => {
  it('amitiés lisibles de la réponse ; réponse sans liste : erreur', async () => {
    let body: unknown = { friendships: [{ id: 'f1', status: 'accepted' }, { id: 3 }], counts: {} };
    connectFakeSite('https://www.wiki-masters.com/trades', (url) => (url.pathname === '/api/friends' ? Response.json(body) : undefined));
    await expect(fetchFriendships()).resolves.toEqual([{ id: 'f1', status: 'accepted' }]);
    body = { error: 'x' };
    await expect(fetchFriendships()).rejects.toMatchObject({ message: 'Réponse inattendue du site.' });
  });
});
