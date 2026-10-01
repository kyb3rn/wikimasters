import { describe, expect, it } from 'vitest';
import { mergeEntries } from '@/features/notifications/entries';

describe('liste de la cloche', () => {
  it('mêle notifications du site et du script, des plus récentes aux plus anciennes', () => {
    const entries = mergeEntries(
      [
        { id: 's2', type: 'marketplace_auction_won', data: { card_title: 'Opale' }, read: false, created_at: '2026-09-30T12:00:00Z' },
        { id: 's1', type: 'inconnu', data: {}, read: true, created_at: '2026-09-30T10:00:00Z' },
      ],
      [{ id: 'l1', title: 'Enchère publiée', message: '« Opale » est aux enchères.', variant: 'success', createdAt: Date.parse('2026-09-30T11:00:00Z'), read: false }],
    );
    expect(entries.map((e) => [e.key, e.icon, e.label, e.text, e.read])).toEqual([
      ['site:s2', 'trophy', 'Enchère gagnée', 'Vous avez remporté « Opale » !', false],
      ['local:l1', 'success', 'Enchère publiée', '« Opale » est aux enchères.', false],
      ['site:s1', 'message', 'inconnu', 'Nouvelle notification', true],
    ]);
  });
});
