import { describe, expect, it } from 'vitest';
import { readGuildsResponse } from '@/site/guild';

describe('readGuildsResponse', () => {
  it('guilde de `GET /api/guilds`, `null` sans guilde', () => {
    expect(readGuildsResponse({ guild: { id: 'g1', name: 'Zguegito', description: '…' }, membership: {} })).toEqual({ id: 'g1', name: 'Zguegito' });
    expect(readGuildsResponse({ guild: null, membership: null })).toBeNull();
    expect(readGuildsResponse({ error: 'Erreur serveur' })).toBeUndefined();
  });
});
