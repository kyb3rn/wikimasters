import { describe, expect, it } from 'vitest';
import { createArrivals } from '@/features/notifications/arrivals';
import type { SiteNotification } from '@/site/notifications';

const n = (id: string, read = false): SiteNotification => ({ id, type: 'chat_message', data: {}, read, created_at: '2026-09-30T10:00:00Z' });

describe('nouvelles notifications du site', () => {
  it('ne montre rien de la première liste lue dans la page, puis chaque inconnue non lue', () => {
    const arrivals = createArrivals();
    expect(arrivals.seen([])).toEqual([]);
    expect(arrivals.seen([n('b'), n('a')])).toEqual([]);
    // Deux arrivées d'un coup (relecture après une coupure) : de la plus ancienne à la plus récente.
    expect(arrivals.seen([n('d'), n('c'), n('b'), n('a')]).map((x) => x.id)).toEqual(['c', 'd']);
    expect(arrivals.seen([n('e', true), n('d'), n('c')])).toEqual([]);
  });

  it('la première réponse du réseau vaut point de départ, même vide', () => {
    const arrivals = createArrivals();
    arrivals.listed([]);
    expect(arrivals.seen([n('a')]).map((x) => x.id)).toEqual(['a']);

    const other = createArrivals();
    other.listed(['a']);
    other.listed(['b']);
    expect(other.seen([n('b'), n('a')]).map((x) => x.id)).toEqual(['b']);
  });
});
