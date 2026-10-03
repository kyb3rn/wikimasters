import { describe, expect, it } from 'vitest';
import {
  parseFriendRequests,
  withAnswer,
  withArrival,
  withFriendships,
  withProfile,
  withSiteAction,
  type FriendRequests,
} from '@/features/notifications/friend-requests';

const pending = (requesterId: string, at: number, friendshipId?: string) => ({
  requesterId,
  state: 'pending' as const,
  at,
  ...(friendshipId !== undefined && { friendshipId }),
});

describe("demandes d'ami arrivées sous les yeux du script", () => {
  it('relit le stockage en écartant ce qui ne se lit pas', () => {
    expect(
      parseFriendRequests({
        n1: { requesterId: 'u1', state: 'accepted', at: 1, friendshipId: 'f1' },
        n2: { requesterId: 'u2', state: 'perdue', at: 2 },
        n3: { requesterId: 'u3', state: 'pending' },
      }),
    ).toEqual({ n1: { requesterId: 'u1', state: 'accepted', at: 1, friendshipId: 'f1' } });
    expect(parseFriendRequests([])).toBeUndefined();
  });

  it("retient une arrivée sans toucher à une demande déjà retenue ; les plus anciennes partent au-delà du maximum", () => {
    const answered: FriendRequests = { n1: { requesterId: 'u1', state: 'accepted', at: 1 } };
    expect(withArrival(answered, 'n1', 'u1', 5)).toBe(answered);
    const two = withArrival(withArrival(answered, 'n2', 'u2', 2), 'n3', 'u3', 3, 2);
    expect(Object.keys(two)).toEqual(['n2', 'n3']);
    expect(two.n3).toEqual(pending('u3', 3));
  });

  it('une réponse vaut pour toutes les demandes en attente du joueur', () => {
    const requests: FriendRequests = { n1: pending('u1', 1), n2: pending('u1', 2), n3: pending('u2', 3) };
    const answered = withAnswer(requests, 'u1', 'declined');
    expect([answered.n1?.state, answered.n2?.state, answered.n3?.state]).toEqual(['declined', 'declined', 'pending']);
    expect(withAnswer(answered, 'u3', 'accepted')).toBe(answered);
  });

  it("confrontées aux amitiés : id de la demande en attente, sinon amis ou plus en attente", () => {
    const requests: FriendRequests = { n1: pending('u1', 1), n2: pending('u2', 1), n3: pending('u3', 1), n4: pending('u4', 50) };
    const friendships = [
      { id: 'f1', status: 'pending', requester_id: 'u1', addressee_id: 'moi' },
      { id: 'f2', status: 'accepted', requester_id: 'moi', addressee_id: 'u2' },
    ];
    const next = withFriendships(requests, friendships, 10);
    expect(next.n1).toEqual(pending('u1', 1, 'f1'));
    expect(next.n2?.state).toBe('accepted');
    expect(next.n3?.state).toBe('gone');
    // Arrivée après le départ de la lecture : peut-être absente de la réponse.
    expect(next.n4).toEqual(pending('u4', 50));
    expect(withFriendships(next, friendships, 10)).toBe(next);
  });

  it("profil d'un joueur : id de l'amitié, ou déjà amis", () => {
    const requests: FriendRequests = { n1: pending('u1', 1), n2: pending('u2', 1) };
    expect(withProfile(requests, { playerId: 'u1', isFriend: false, friendshipId: 'f1' }).n1).toEqual(pending('u1', 1, 'f1'));
    expect(withProfile(requests, { playerId: 'u2', isFriend: true, friendshipId: 'f2' }).n2?.state).toBe('accepted');
    expect(withProfile(requests, { playerId: 'u3', isFriend: false, friendshipId: undefined })).toBe(requests);
  });

  it('réponse du site : reconnue à son amitié, « Tout accepter » vaut pour toutes', () => {
    const requests: FriendRequests = { n1: pending('u1', 1, 'f1'), n2: pending('u2', 1, 'f2'), n3: pending('u3', 1) };
    expect(withSiteAction(requests, { kind: 'decline', id: 'f1' }).n1?.state).toBe('declined');
    expect(withSiteAction(requests, { kind: 'accept', id: 'f2' }).n2?.state).toBe('accepted');
    expect(withSiteAction(requests, { kind: 'accept', id: 'f9' })).toBe(requests);
    const all = withSiteAction(requests, { kind: 'accept-all' });
    expect(Object.values(all).map((request) => request.state)).toEqual(['accepted', 'accepted', 'accepted']);
  });
});
