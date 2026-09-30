import { describe, expect, it } from 'vitest';
import { orderOf, rangeTotal, readRow, runCollectionProbe, tagMix, type ProbeIo, type ProbeRow } from '@/features/debug/probe';

const row = (id: string, fields: Partial<ProbeRow> = {}): ProbeRow => ({
  id,
  title: id,
  rarity: 'C',
  obtainedAt: '2026-09-01T00:00:00Z',
  starred: false,
  shiny: false,
  atk: 1000,
  def: 1000,
  qScore: 1,
  pageviews: 1,
  category: 'x',
  cardCreatedAt: '2026-01-01T00:00:00Z',
  tagIds: [],
  ...fields,
});

describe('sonde de la Collection', () => {
  it('lit une ligne de /api/my-collection, rareté et statistiques de l’exemplaire en priorité', () => {
    const parsed = readRow({
      id: 'e1',
      card: { wikipedia_title: 'Brésil', rarity: 'UR', atk: 10, def: 20, q_score: 93, pageviews: 5, category: 'pays' },
      snapshot_rarity: 'L',
      snapshot_atk: 11,
      tags: [{ id: 't1', name: 'keep' }, 'bruit'],
      starred: true,
      is_shiny: false,
      obtained_at: '2026-09-26T00:53:00Z',
    });
    expect(parsed).toMatchObject({ id: 'e1', title: 'Brésil', rarity: 'L', atk: 11, def: 20, starred: true, tagIds: ['t1'] });
    expect(readRow({ card: {} })).toBeUndefined();
  });

  it('reconnaît l’ordre d’une liste, sens compris', () => {
    const rows = ['2026-09-05', '2026-09-04', '2026-09-03', '2026-09-02'].map((date, i) =>
      row(`e${i}`, { obtainedAt: date, title: ['d', 'a', 'c', 'b'][i] ?? '', atk: [4, 3, 2, 1][i] ?? 0 }),
    );
    const order = orderOf(rows);
    expect(order).toContain('ajout ↓');
    expect(order).toContain('atk ↓');
    expect(order).not.toContain('nom');
    expect(order).not.toContain('favori');
  });

  it('range les raretés de C à L, pas dans l’ordre alphabétique', () => {
    const rows = ['L', 'UR', 'SR', 'R', 'PC', 'C'].map((rarity, i) => row(`e${i}`, { rarity, obtainedAt: `2026-09-0${i + 1}` }));
    expect(orderOf(rows)).toContain('rareté ↓');
  });

  it('compte les étiquettes A et B d’une liste', () => {
    const rows = [row('1', { tagIds: ['a'] }), row('2', { tagIds: ['a', 'b'] }), row('3', { tagIds: ['c'] })];
    expect(tagMix(rows, 'a', 'b')).toEqual({ avecA: 2, avecB: 1, avecLesDeux: 1, niAniB: 1 });
  });

  it('lit le total d’un Content-Range', () => {
    expect(rangeTotal('0-0/1461')).toBe(1461);
    expect(rangeTotal('*/0')).toBe(0);
    expect(rangeTotal('0-9/*')).toBeUndefined();
    expect(rangeTotal(null)).toBeUndefined();
  });

  it('s’arrête sur une session expirée et rend le rapport', async () => {
    const calls: string[] = [];
    const io: ProbeIo = {
      site: (path) => {
        calls.push(path);
        return Promise.resolve(new Response('{}', { status: 401 }));
      },
      supabase: () => Promise.reject(new Error('inattendu')),
      userId: () => 'u1',
      progress: () => undefined,
      sleep: () => Promise.resolve(),
    };
    const report = await runCollectionProbe(io);
    expect(report.stopped).toContain('session expirée');
    expect(calls).toEqual(['/api/my-collection/stats?sort=rarity']);
  });

  it('relance une lecture en échec, remplace les identifiants des étiquettes et de l’utilisateur', async () => {
    const tagOptions = [
      { id: 'tag-b', name: 'trade', cardCount: 10 },
      { id: 'tag-a', name: 'keep', cardCount: 20 },
    ];
    let first = true;
    const io: ProbeIo = {
      site: (path) => {
        if (first) {
          first = false;
          return Promise.resolve(new Response('', { status: 500 }));
        }
        const body = path.startsWith('/api/my-collection/stats') ? { total: 5, rarityCounts: { C: 3, R: 2 }, tagOptions } : { collection: [] };
        return Promise.resolve(Response.json(body));
      },
      supabase: () => Promise.resolve(new Response('[]', { headers: { 'content-range': '0-0/7' } })),
      userId: () => 'user-1',
      progress: () => undefined,
      sleep: () => Promise.resolve(),
    };
    const report = await runCollectionProbe(io);
    expect(report.stopped).toBeUndefined();
    expect(report.tags).toEqual([
      { name: 'keep', cardCount: 20 },
      { name: 'trade', cardCount: 10 },
    ]);
    expect(report.stats[0]).toMatchObject({ test: 'référence', status: 200, total: 5, sommeRaretés: 5 });
    const text = JSON.stringify(report);
    expect(text).not.toMatch(/tag-a|tag-b|user-1/);
    expect(report.stats.some((entry) => entry.query === 'sort=rarity&tag_id=A&tag_id=B')).toBe(true);
    expect(report.supabase.find((entry) => entry.test === 'A et B')).toMatchObject({ status: 200, total: 7 });
  });
});
