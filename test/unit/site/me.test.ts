import { describe, expect, it } from 'vitest';
import { findMe } from '@/site/me';

const player = (id: string, username: string) => ({ id, username, avatar_url: null });

describe('findMe', () => {
  it('profil du joueur connecté (sync_profile_packs, get_my_profile)', () => {
    expect(findMe({ ...player('me', 'Vreeecht'), is_pro: true }, 'me')).toEqual({ id: 'me', username: 'Vreeecht' });
    expect(findMe(player('me', 'Vreeecht'), undefined)).toEqual({ id: 'me', username: 'Vreeecht' });
    expect(findMe(player('autre', 'Autre'), 'me')).toBeUndefined();
  });

  it('dans ses amitiés, seulement avec son id', () => {
    const friends = { friendships: [{ id: 'f1', status: 'accepted', requester: player('a', 'Aline'), addressee: player('me', 'Vreeecht') }] };
    expect(findMe(friends, 'me')).toEqual({ id: 'me', username: 'Vreeecht' });
    expect(findMe(friends, undefined)).toBeUndefined();
    expect(findMe({ friendships: [] }, 'me')).toBeUndefined();
  });
});
