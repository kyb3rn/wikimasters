import { describe, expect, it } from 'vitest';
import {
  durationLabel,
  lastInRarity,
  parseCardSales,
  storedCardSales,
  withoutRecord,
  withRecord,
  type SaleRecord,
} from '@/features/auction-modal/history';

const record = (at: number, overrides: Partial<SaleRecord> = {}): SaleRecord => ({
  at,
  price: 100,
  minutes: 10,
  rarity: 'SR',
  shiny: false,
  auctionId: `a${at}`,
  ...overrides,
});

describe('historique des mises en vente', () => {
  it('relit son propre format, de la plus récente à la plus ancienne', () => {
    const sales = { cardId: 'c1', title: 'Tour Eiffel', records: [record(2), record(1, { rarity: 'L', shiny: true, minutes: undefined })] };
    const stored = storedCardSales(sales);
    expect(stored).toEqual({
      id: 'c1',
      title: 'Tour Eiffel',
      attempts: [
        { at: 2, price: 100, minutes: 10, rarity: 'SR', shiny: false, auctionId: 'a2' },
        { at: 1, price: 100, minutes: undefined, rarity: 'L', shiny: true, auctionId: 'a1' },
      ],
    });
    expect(parseCardSales({ ...stored, attempts: [...stored.attempts].reverse() })).toEqual(sales);
  });

  it('relit l’ancien wm-vente : essais publiés seulement, durée en secondes, « SHINY » = L shiny', () => {
    const legacy = {
      id: 'c1',
      title: 'Tour Eiffel',
      rarity: 'SR',
      price: 120,
      attempts: [
        { at: 30, price: 120, duration: { secs: 3600, text: '1 h' }, rarity: 'SR', ok: true, auctionId: 'x3' },
        { at: 20, price: 90, duration: { secs: 600, text: '10 min' }, rarity: 'SR', ok: null, auctionId: null },
        { at: 10, price: 5000, duration: null, rarity: 'SHINY', ok: true, auctionId: null },
        { at: 'hier', price: 1, ok: true },
      ],
    };
    expect(parseCardSales(legacy)?.records).toEqual([
      { at: 30, price: 120, minutes: 60, rarity: 'SR', shiny: false, auctionId: 'x3' },
      { at: 10, price: 5000, minutes: undefined, rarity: 'L', shiny: true, auctionId: undefined },
    ]);
  });

  it('ignore un enregistrement illisible', () => {
    expect(parseCardSales(undefined)).toBeUndefined();
    expect(parseCardSales({ id: 'c1' })).toBeUndefined();
    expect(parseCardSales({ id: 3, attempts: [] })).toBeUndefined();
  });

  it('ajoute en tête, remplace la même enchère, retire par date', () => {
    const sales = { cardId: 'c1', title: '', records: [record(1)] };
    const added = withRecord(sales, record(5));
    expect(added.records.map((r) => r.at)).toEqual([5, 1]);
    expect(withRecord(added, record(6, { auctionId: 'a5' })).records.map((r) => r.at)).toEqual([6, 1]);
    expect(withoutRecord(added, 5).records.map((r) => r.at)).toEqual([1]);
  });

  it('ne reprend que la plus récente de la même rareté, shiny compris', () => {
    const records = [record(4, { rarity: 'UR' }), record(3, { rarity: 'L', shiny: true }), record(2, { rarity: 'L' }), record(1)];
    expect(lastInRarity(records, 'SR', false)?.at).toBe(1);
    expect(lastInRarity(records, 'L', false)?.at).toBe(2);
    expect(lastInRarity(records, 'L', true)?.at).toBe(3);
    expect(lastInRarity(records, 'C', false)).toBeUndefined();
    expect(lastInRarity(records, undefined, false)).toBeUndefined();
  });

  it('écrit la durée comme le site', () => {
    expect([10, 30, 60, 180, 720, 1440, 2880].map(durationLabel)).toEqual(['10 min', '30 min', '1 h', '3 h', '12 h', '24 h', '2 j']);
  });
});
