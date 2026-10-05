import { describe, expect, it } from 'vitest';
import type { DataItem } from '@/core/data';
import { addCounts, formatBytes, importSummary, matchesFilters, NO_FILTERS, resultsLabel, sameFilters, selectItems, sortOptions, totalOf } from '@/features/memory/list';

const DAY = 86_400_000;
const item = (title: string, extra: Partial<DataItem> = {}): DataItem => ({ key: title, title, bytes: 10, ...extra });

describe('listes de la Mémoire', () => {
  it('tailles en octets, Ko, Mo', () => {
    expect(formatBytes(812)).toBe('812 o');
    expect(formatBytes(4200)).toBe('4,2 Ko');
    expect(formatBytes(3_140_000)).toBe('3,1 Mo');
  });

  it('recherche dans le titre sans accents ni casse, puis tri', () => {
    const items = [item('Tour Eiffel', { date: 1, count: 3, bytes: 5 }), item('Église', { date: 3, count: 1, bytes: 50 }), item('Rome', { date: 2 })];
    expect(selectItems(items, 'EGLI', 'date').map((found) => found.title)).toEqual(['Église']);
    expect(selectItems(items, '', 'date').map((found) => found.title)).toEqual(['Église', 'Rome', 'Tour Eiffel']);
    expect(selectItems(items, '', 'title').map((found) => found.title)).toEqual(['Église', 'Rome', 'Tour Eiffel']);
    expect(selectItems(items, '', 'count').map((found) => found.title)).toEqual(['Tour Eiffel', 'Église', 'Rome']);
    expect(selectItems(items, '', 'bytes').map((found) => found.title)).toEqual(['Église', 'Rome', 'Tour Eiffel']);
  });

  it('« Nombre » seulement si les éléments en ont un', () => {
    expect(sortOptions([item('a')]).map((option) => option.value)).toEqual(['date', 'title', 'bytes']);
    expect(sortOptions([item('a', { count: 2 })]).map((option) => option.value)).toEqual(['date', 'title', 'count', 'bytes']);
  });

  it('filtres des ventes : raretés, prix médian, nombre, chargement, dernière vente', () => {
    const now = 100 * DAY;
    const eiffel = item('Tour Eiffel', { date: now - DAY, count: 3, medians: { R: 20, C: 10 }, lastSale: now - 3 * DAY });
    const rome = item('Rome', { date: now - 40 * DAY, count: 1, medians: { UR: 180 }, lastSale: now - 41 * DAY, stale: true });
    const eglise = item('Église', { count: 0, medians: {} });
    const titles = (filters: Partial<typeof NO_FILTERS>) =>
      [eiffel, rome, eglise].filter((found) => matchesFilters(found, { ...NO_FILTERS, ...filters }, now)).map((found) => found.title);

    expect(titles({})).toEqual(['Tour Eiffel', 'Rome', 'Église']);
    expect(titles({ rarities: ['UR', 'C'] })).toEqual(['Tour Eiffel', 'Rome']);
    // Médiane des raretés cochées ; aucune cochée : de n'importe laquelle.
    expect(titles({ priceMin: 15 })).toEqual(['Tour Eiffel', 'Rome']);
    expect(titles({ rarities: ['C'], priceMin: 15 })).toEqual([]);
    expect(titles({ priceMin: 10, priceMax: 10 })).toEqual(['Tour Eiffel']);
    expect(titles({ countMin: 1, countMax: 2 })).toEqual(['Rome']);
    expect(titles({ countMax: 0 })).toEqual(['Église']);
    expect(titles({ loadedDays: 'stale' })).toEqual(['Rome']);
    // Chargée il y a plus de n jours : seulement les éléments datés.
    expect(titles({ loadedDays: 30 })).toEqual(['Rome']);
    expect(titles({ loadedDays: 0 })).toEqual(['Tour Eiffel', 'Rome', 'Église']);
    // Sans vente du tout : pas vendue depuis.
    expect(titles({ idleDays: 30 })).toEqual(['Rome', 'Église']);
    expect(selectItems([eiffel, rome, eglise], 'rom', 'date', { ...NO_FILTERS, loadedDays: 'stale' }, now).map((found) => found.title)).toEqual(['Rome']);
  });

  it('filtres identiques, raretés dans n’importe quel ordre', () => {
    expect(sameFilters({ ...NO_FILTERS, rarities: ['L', 'C'] }, { ...NO_FILTERS, rarities: ['C', 'L'] })).toBe(true);
    expect(sameFilters({ ...NO_FILTERS, priceMax: 5 }, NO_FILTERS)).toBe(false);
  });

  it('résultats : tout, ou ce que la recherche et les filtres montrent', () => {
    expect(resultsLabel(1340, 1340)).toBe('1 340 éléments');
    expect(resultsLabel(1, 1340)).toBe('1 élément sur 1 340');
  });

  it('total : nombre, taille, plus récent', () => {
    expect(totalOf([item('a', { date: 5 }), item('b', { date: 9, bytes: 30 }), item('c')])).toEqual({ count: 3, bytes: 50, latest: 9 });
    expect(totalOf([])).toEqual({ count: 0, bytes: 0, latest: undefined });
  });

  it('résumé d’un import', () => {
    expect(importSummary({ added: 1200, updated: 1, unchanged: 0, invalid: 2 })).toBe('1 200 ajouts · 1 mise à jour · 2 illisibles');
    expect(importSummary({ added: 0, updated: 0, unchanged: 0, invalid: 0 })).toBe('Rien à importer');
    expect(
      addCounts([
        { added: 1, updated: 2, unchanged: 3, invalid: 0 },
        { added: 1, updated: 0, unchanged: 1, invalid: 1 },
      ]),
    ).toEqual({ added: 2, updated: 2, unchanged: 4, invalid: 1 });
  });
});
