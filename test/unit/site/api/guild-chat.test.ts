import { describe, expect, it } from 'vitest';
import { parseGuildMessage } from '@/site/api';

describe('parseGuildMessage', () => {
  it('lit un message de l’API avec son auteur (objet ou tableau)', () => {
    const sender = { id: 'u1', username: 'Kerv_7', avatar_url: null, avatar_pos_x: 50, avatar_pos_y: 50 };
    const raw = { id: 'm1', guild_id: 'g1', sender_id: 'u1', content: 'Tqt', type: 'message', created_at: '2026-09-30T23:51:43.140124+00:00' };
    const expected = {
      id: 'm1',
      senderId: 'u1',
      content: 'Tqt',
      type: 'message',
      createdAt: '2026-09-30T23:51:43.140124+00:00',
      sender: { id: 'u1', username: 'Kerv_7', avatarUrl: undefined, avatarPosX: 50, avatarPosY: 50 },
    };
    expect(parseGuildMessage({ ...raw, sender })).toEqual(expected);
    expect(parseGuildMessage({ ...raw, sender: [sender] })).toEqual(expected);
  });

  it('ligne du temps réel : sans auteur ; annonce de la guilde', () => {
    expect(parseGuildMessage({ id: 'm2', sender_id: 'u1', content: 'x', created_at: '2026-10-01T00:00:00Z' })?.sender).toBeUndefined();
    expect(parseGuildMessage({ id: 'm3', sender_id: null, content: 'X a rejoint la guilde.', type: 'event', created_at: '2026-10-01T00:00:00Z' })).toMatchObject({
      senderId: null,
      type: 'event',
    });
  });

  it('refuse un message illisible', () => {
    expect(parseGuildMessage({ id: 'm1', content: 'x', created_at: 'hier' })).toBeUndefined();
    expect(parseGuildMessage({ content: 'x', created_at: '2026-10-01T00:00:00Z' })).toBeUndefined();
  });
});
