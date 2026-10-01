import { describe, expect, it } from 'vitest';
import type { FriendsData } from '@/site/api';
import { applyFriendsChange, friendsOwner } from '@/site/friends';
import { friendship } from '../../support';

const DATA: FriendsData = {
  friendships: [
    friendship('f1', 'accepted', 'me', 'u1'),
    friendship('f2', 'accepted', 'u2', 'me'),
    friendship('r1', 'pending', 'u7', 'me'),
    friendship('r2', 'pending', 'u8', 'me'),
    friendship('s1', 'pending', 'me', 'u9'),
  ],
  counts: { accepted: 2, incoming: 2, outgoing: 1 },
};

const statuses = (data: FriendsData | undefined) => data?.friendships.map((f) => `${f.id}:${f.status}`);

describe('changements de la page Amis', () => {
  it('demande acceptée : devient un ami, compteurs suivis, le reste gardé tel quel', () => {
    const next = applyFriendsChange(DATA, { kind: 'accept', id: 'r1' }, undefined);
    expect(statuses(next)).toEqual(['f1:accepted', 'f2:accepted', 'r1:accepted', 'r2:pending', 's1:pending']);
    expect(next?.counts).toEqual({ accepted: 3, incoming: 1, outgoing: 1 });
    expect(next?.friendships[2]).toMatchObject({ requester: { username: 'u7' } });
  });

  it('demande refusée, demande annulée, ami retiré : retirés de leur compteur', () => {
    expect(applyFriendsChange(DATA, { kind: 'decline', id: 'r2' }, undefined)?.counts).toEqual({ accepted: 2, incoming: 1, outgoing: 1 });
    expect(applyFriendsChange(DATA, { kind: 'delete', id: 's1' }, undefined)?.counts).toEqual({ accepted: 2, incoming: 2, outgoing: 0 });
    const removed = applyFriendsChange(DATA, { kind: 'delete', id: 'f1' }, undefined);
    expect(removed?.counts).toEqual({ accepted: 1, incoming: 2, outgoing: 1 });
    expect(statuses(removed)).not.toContain('f1:accepted');
  });

  it('tout accepter : les demandes reçues seulement, joueur connecté requis', () => {
    const next = applyFriendsChange(DATA, { kind: 'accept-all' }, 'me');
    expect(statuses(next)).toEqual(['f1:accepted', 'f2:accepted', 'r1:accepted', 'r2:accepted', 's1:pending']);
    expect(next?.counts).toEqual({ accepted: 4, incoming: 0, outgoing: 1 });
    expect(applyFriendsChange(DATA, { kind: 'accept-all' }, undefined)).toBeUndefined();
  });

  it('demande envoyée : ajoutée aux demandes envoyées', () => {
    const sent = friendship('s2', 'pending', 'me', 'u10');
    const next = applyFriendsChange(DATA, { kind: 'add', friendship: sent }, undefined);
    expect(next?.friendships.at(-1)).toBe(sent);
    expect(next?.counts).toEqual({ accepted: 2, incoming: 2, outgoing: 2 });
  });

  it('un changement déjà appliqué est sans effet (rejoué)', () => {
    const changes = [
      { kind: 'accept', id: 'r1' },
      { kind: 'decline', id: 'r2' },
      { kind: 'delete', id: 's1' },
      { kind: 'add', friendship: friendship('s2', 'pending', 'me', 'u10') },
      { kind: 'accept-all' },
    ] as const;
    for (const change of changes) {
      const once = applyFriendsChange(DATA, change, 'me');
      expect(once && applyFriendsChange(once, change, 'me')).toEqual(once);
    }
  });

  it('joueur connecté : le seul présent dans toutes les amitiés', () => {
    expect(friendsOwner(DATA.friendships)).toBe('me');
    expect(friendsOwner(DATA.friendships.slice(0, 1))).toBeUndefined();
    expect(friendsOwner([])).toBeUndefined();
  });
});
