import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fakeStorage } from '../../support';

const storage = fakeStorage();
vi.stubGlobal('localStorage', storage);
vi.stubGlobal('window', { addEventListener: vi.fn() });

const { importWishedPrices, mergeWishedPrices, parseWishedPrices, removeWishedPrices, setWishedPrice, wishedPrice, wishedPriceKey, onWishedPricesChange } =
  await import('@/services/wished-price');

const eiffel = { cardId: 'c1', title: 'Tour Eiffel', rarity: 'L' as const, shiny: false };

describe('prix souhaité', () => {
  beforeEach(() => {
    for (const card of [eiffel, { ...eiffel, shiny: true }, { ...eiffel, rarity: 'UR' as const }]) setWishedPrice(card, undefined);
  });

  it('clé : la carte et la rareté de l’exemplaire, la L shiny à part', () => {
    expect(wishedPriceKey(eiffel)).toBe('c1:L');
    expect(wishedPriceKey({ ...eiffel, shiny: true })).toBe('c1:L:shiny');
    expect(wishedPriceKey({ ...eiffel, rarity: 'UR' })).toBe('c1:UR');
  });

  it('enregistré par carte et rareté : une autre rareté, ou la shiny, n’a pas le sien', () => {
    setWishedPrice(eiffel, 1500);
    expect(wishedPrice(eiffel)?.price).toBe(1500);
    expect(wishedPrice({ ...eiffel, shiny: true })).toBeUndefined();
    expect(wishedPrice({ ...eiffel, rarity: 'UR' })).toBeUndefined();
    expect(JSON.parse(storage.data.get('wm-wished-prices-v1') ?? '{}')).toMatchObject({ 'c1:L': { price: 1500, title: 'Tour Eiffel' } });
    setWishedPrice(eiffel, undefined);
    expect(wishedPrice(eiffel)).toBeUndefined();
  });

  it('prévient de chaque changement', () => {
    const seen = vi.fn();
    onWishedPricesChange(seen, { signal: new AbortController().signal });
    setWishedPrice(eiffel, 10);
    expect(seen).toHaveBeenCalledTimes(1);
  });

  it('stockage relu : entrées illisibles écartées', () => {
    expect(parseWishedPrices({ a: { price: 10, at: 1, title: 'x' }, b: { price: -1 }, c: { price: 1.5 }, d: 'x' })).toEqual({
      a: { price: 10, at: 1, title: 'x' },
    });
    expect(parseWishedPrices([])).toBeUndefined();
    expect(parseWishedPrices('x')).toBeUndefined();
  });
});

describe('fusion des prix souhaités', () => {
  const price = (value: number, at: number) => ({ price: value, at, title: 'Tour Eiffel' });

  it('le plus récemment fixé l’emporte ; absent ici, ajouté', () => {
    const { result, outcomes } = mergeWishedPrices(
      { 'c1:L': price(1500, 10), 'c1:UR': price(300, 50) },
      { 'c1:L': price(1800, 20), 'c1:UR': price(250, 40), 'c2:R': price(20, 5) },
    );
    expect(result).toEqual({ 'c1:L': price(1800, 20), 'c1:UR': price(300, 50), 'c2:R': price(20, 5) });
    expect(outcomes).toEqual(['updated', 'unchanged', 'added']);
  });

  it('import : comptes, entrées illisibles écartées, puis écrit ; retrait par clé', () => {
    setWishedPrice(eiffel, undefined);
    const file = { 'c1:L': price(1200, 1), 'c1:UR': { price: -3 } };
    expect(importWishedPrices(file, false)).toEqual({ added: 1, updated: 0, unchanged: 0, invalid: 1 });
    expect(wishedPrice(eiffel)).toBeUndefined();
    importWishedPrices(file, true);
    expect(wishedPrice(eiffel)?.price).toBe(1200);
    removeWishedPrices(['c1:L']);
    expect(wishedPrice(eiffel)).toBeUndefined();
  });
});
