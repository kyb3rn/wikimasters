import { describe, expect, it } from 'vitest';
import { parseTabRead, readElsewhere } from '@/features/notifications/tabs';
import type { SiteNotification } from '@/site/notifications';

const n = (id: string, createdAt: string, read = false): SiteNotification => ({ id, type: 'chat_message', data: {}, read, created_at: createdAt });

const LIST = [n('c', '2026-09-30T12:00:05Z'), n('b', '2026-09-30T12:00:00Z'), n('a', '2026-09-30T11:00:00Z', true)];

describe('lectures entre onglets', () => {
  it("relit le message d'un autre onglet", () => {
    expect(parseTabRead({ ids: ['a', 'b'] })).toEqual({ ids: ['a', 'b'] });
    expect(parseTabRead({ before: 12 })).toEqual({ before: 12 });
    expect(parseTabRead({ ids: ['a', 1] })).toBeUndefined();
    expect(parseTabRead({ before: Number.NaN })).toBeUndefined();
    expect(parseTabRead('tout')).toBeUndefined();
  });

  it('ne lit que les non lues visées', () => {
    expect(readElsewhere(LIST, { ids: ['a', 'b', 'z'] })).toEqual(['b']);
    expect(readElsewhere(LIST, { ids: [] })).toEqual([]);
  });

  it('« tout marquer » : seulement celles créées avant le départ de la requête', () => {
    expect(readElsewhere(LIST, { before: Date.parse('2026-09-30T12:00:00Z') })).toEqual(['b']);
    expect(readElsewhere(LIST, { before: Date.parse('2026-09-30T12:01:00Z') })).toEqual(['c', 'b']);
  });
});
