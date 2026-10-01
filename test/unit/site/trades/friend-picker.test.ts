import { describe, expect, it } from 'vitest';
import { parseFriendships } from '@/site/api';
import { acceptedFriends, friendshipDates } from '@/site/trades';

const player = (id: string, username: string) => ({ id, username, avatar_url: null, avatar_pos_x: 20, avatar_pos_y: 80, activity_blocked_until: null });
const FRIENDS = {
  friendships: [
    { id: 'f1', status: 'accepted', requester_id: 'me', addressee_id: 'a', requester: player('me', 'Moi'), addressee: player('a', 'Aline'), created_at: '2026-09-01T10:00:00Z' },
    { id: 'f2', status: 'accepted', requester_id: 'b', addressee_id: 'me', requester: player('b', 'Bruno'), addressee: player('me', 'Moi'), created_at: '2026-09-20T10:00:00Z' },
    { id: 'f3', status: 'pending', requester_id: 'c', addressee_id: 'me', requester: player('c', 'Chloé'), addressee: player('me', 'Moi'), created_at: '2026-09-25T10:00:00Z' },
  ],
  counts: { accepted: 2, incoming: 1, outgoing: 0 },
};

describe('amis de GET /api/friends', () => {
  it('comme le site : l’autre joueur de chaque amitié acceptée', () => {
    expect(acceptedFriends(parseFriendships(FRIENDS), 'me')).toEqual([
      { id: 'a', username: 'Aline', avatar_url: null, avatar_pos_x: 20, avatar_pos_y: 80 },
      { id: 'b', username: 'Bruno', avatar_url: null, avatar_pos_x: 20, avatar_pos_y: 80 },
    ]);
    expect(acceptedFriends(parseFriendships({ error: 'x' }), 'me')).toEqual([]);
  });

  it('date de chaque amitié acceptée, par ami', () => {
    expect(friendshipDates(parseFriendships(FRIENDS), 'me')).toEqual(
      new Map([
        ['a', Date.parse('2026-09-01T10:00:00Z')],
        ['b', Date.parse('2026-09-20T10:00:00Z')],
      ]),
    );
  });
});
