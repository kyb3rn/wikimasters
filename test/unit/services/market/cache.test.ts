import { describe, expect, it } from 'vitest';
import { mergeEntry, parseStoredEntry, storedEntry } from '@/services/market/cache';

// Forme écrite par l'ancien script (bibliothèque marché) dans la même base : relue telle quelle.
const LEGACY = {
  id: 'c1',
  fetchedAt: 1_790_000_000_000,
  title: 'Tour Eiffel',
  sales: [
    { id: 's2', final_price: 20, settled_at: '2026-09-25T00:00:00.000Z', rarity: 'R' },
    { id: 's1', final_price: 10, settled_at: '2026-09-24T00:00:00.000Z', rarity: 'C' },
  ],
};

describe('cache des ventes', () => {
  it('relit un enregistrement de l’ancien script, ventes triées par date', () => {
    const entry = parseStoredEntry(LEGACY);
    expect(entry?.cardId).toBe('c1');
    expect(entry?.title).toBe('Tour Eiffel');
    expect(entry?.sales.map((sale) => sale.id)).toEqual(['s1', 's2']);
  });

  it('réécrit dans la même forme', () => {
    const entry = parseStoredEntry(LEGACY);
    if (!entry) throw new Error('entrée attendue');
    expect(storedEntry(entry)).toEqual({ ...LEGACY, sales: [LEGACY.sales[1], LEGACY.sales[0]] });
  });

  it('écarte ce qui n’est pas un enregistrement de ventes', () => {
    expect(parseStoredEntry({ id: 'c1', title: 'x' })).toBeUndefined();
    expect(parseStoredEntry('c1')).toBeUndefined();
    expect(parseStoredEntry({ ...LEGACY, fetchedAt: 'hier' })).toBeUndefined();
  });
});

describe('fusion des ventes d’une carte', () => {
  const at = (id: string, time: number) => ({ id, price: 10, time, rarity: 'R' });
  const entry = (fetchedAt: number, sales: ReturnType<typeof at>[], title = 'Rome antique') => ({ cardId: 'c1', title, fetchedAt, sales });

  it('absente ici : ajoutée telle quelle', () => {
    const incoming = entry(5, [at('s1', 1)]);
    expect(mergeEntry(undefined, incoming)).toEqual({ entry: incoming, outcome: 'added' });
  });

  it('garde toutes les ventes des deux côtés, une fois chacune, à la date du chargement le plus récent', () => {
    const { entry: merged, outcome } = mergeEntry(entry(10, [at('s1', 1), at('s2', 2)]), entry(20, [at('s2', 2), at('s3', 3)], 'Rome'));
    expect(outcome).toBe('updated');
    expect(merged.sales.map((sale) => sale.id)).toEqual(['s1', 's2', 's3']);
    expect(merged.fetchedAt).toBe(20);
    expect(merged.title).toBe('Rome');
  });

  it('rien de neuf : inchangée (un chargement plus ancien ne change rien)', () => {
    const local = entry(20, [at('s1', 1), at('s2', 2)]);
    expect(mergeEntry(local, entry(10, [at('s1', 1)]))).toEqual({ entry: local, outcome: 'unchanged' });
  });
});
