import { describe, expect, it } from 'vitest';
import type { NetRequest } from '@/core/net';
import { isFriendsListRequest, isFriendshipDelete } from '@/site/api';

const request = (url: string, method = 'GET'): NetRequest => ({
  url: new URL(url, 'https://www.wiki-masters.com'),
  method,
  headers: new Headers(),
  body: undefined,
  own: false,
});

describe('requêtes des amis', () => {
  it('reconnaît le retrait d’une amitié, pas l’acceptation ni les autres routes', () => {
    expect(isFriendshipDelete(request('/api/friends/f1', 'DELETE'))).toBe(true);
    expect(isFriendshipDelete(request('/api/friends/f1', 'PATCH'))).toBe(false);
    expect(isFriendshipDelete(request('/api/friends/accept-all', 'POST'))).toBe(false);
    expect(isFriendshipDelete(request('/api/friends', 'DELETE'))).toBe(false);
  });

  it('reconnaît la relecture de la liste, pas la recherche de joueurs', () => {
    expect(isFriendsListRequest(request('/api/friends'))).toBe(true);
    expect(isFriendsListRequest(request('/api/friends/search?q=al'))).toBe(false);
    expect(isFriendsListRequest(request('/api/friends', 'POST'))).toBe(false);
  });
});
