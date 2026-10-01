import { describe, expect, it } from 'vitest';
import { groupByDay, mergeMessages } from '@/features/guild-chat/messages';
import type { GuildMessage } from '@/site/api';

const sender = { id: 'u1', username: 'Kerv_7', avatarUrl: undefined, avatarPosX: 50, avatarPosY: 50 };
const message = (id: string, createdAt: string, extra: Partial<GuildMessage> = {}): GuildMessage => ({
  id,
  senderId: 'u1',
  content: id,
  type: 'message',
  createdAt,
  sender: undefined,
  ...extra,
});

describe('mergeMessages', () => {
  it('sans doublon, triés par date ; la ligne du temps réel garde l’auteur déjà connu', () => {
    const known = [message('b', '2026-10-01T10:00:00Z', { sender }), message('a', '2026-10-01T09:00:00Z')];
    const merged = mergeMessages(known, [message('b', '2026-10-01T10:00:00Z'), message('c', '2026-10-01T09:30:00Z')]);
    expect(merged.map((m) => m.id)).toEqual(['a', 'c', 'b']);
    expect(merged[2]?.sender).toEqual(sender);
  });
});

describe('groupByDay', () => {
  it('un groupe par jour, dans l’ordre', () => {
    const days = groupByDay([message('a', '2026-09-30T10:00:00'), message('b', '2026-09-30T11:00:00'), message('c', '2026-10-01T09:00:00')]);
    expect(days.map((day) => [day.label, day.messages.map((m) => m.id)])).toEqual([
      ['30 sept.', ['a', 'b']],
      ['1 oct.', ['c']],
    ]);
  });
});
