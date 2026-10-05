import { afterEach, describe, expect, it, vi } from 'vitest';
import { EXPORT_FORMAT, exportFileName, exportJson, parseExport, storedValueData, tally } from '@/core/data';
import { jsonStore } from '@/core/storage';
import { fakeStorage } from '../../support';

afterEach(() => vi.unstubAllGlobals());

describe("fichier d'export", () => {
  it('se relit tel quel, date comprise', () => {
    const exportedAt = Date.UTC(2026, 9, 4, 7, 12);
    const json = JSON.parse(JSON.stringify(exportJson({ script: '0.6.0', exportedAt, data: { settings: { a: 1 } } }))) as unknown;
    expect(json).toMatchObject({ format: EXPORT_FORMAT, version: 1, exportedAt: '2026-10-04T07:12:00.000Z' });
    expect(parseExport(json)).toEqual({ script: '0.6.0', exportedAt, data: { settings: { a: 1 } } });
  });

  it("refuse un JSON qui n'en est pas un", () => {
    expect(parseExport({ data: {} })).toBeUndefined();
    expect(parseExport({ format: EXPORT_FORMAT, data: [] })).toBeUndefined();
    expect(parseExport('texte')).toBeUndefined();
    // Date illisible : 0, le reste passe.
    expect(parseExport({ format: EXPORT_FORMAT, exportedAt: 'hier', data: {} })).toEqual({ script: '', exportedAt: 0, data: {} });
  });

  it('nommé du jour de l’appareil', () => {
    expect(exportFileName(new Date(2026, 9, 4, 23, 59).getTime())).toBe('wikimasters-memoire-2026-10-04.json');
  });
});

describe('comptes d’un import', () => {
  it('compte chaque sort, illisibles à part', () => {
    expect(tally(['added', 'updated', 'added', 'unchanged'], 2)).toEqual({ added: 2, updated: 1, unchanged: 1, invalid: 2 });
  });
});

describe('valeur unique gardée', () => {
  it('une ligne si elle est enregistrée, aucune sinon ; « Oublier » l’efface', async () => {
    const storage = fakeStorage();
    vi.stubGlobal('localStorage', storage);
    const store = jsonStore<string>('wm-x-v1', '', (raw) => (typeof raw === 'string' ? raw : undefined));
    const data = storedValueData({
      id: 'x',
      name: 'Collection',
      tab: 'Filtres retenus',
      description: '',
      key: 'wm-x-v1',
      store,
      describe: (value) => (value ? { details: [`« ${value} »`] } : undefined),
    });
    expect(await data.list()).toEqual([]);
    store.set('rome');
    expect(await data.list()).toEqual([{ key: 'wm-x-v1', title: 'Collection', details: ['« rome »'], date: undefined, bytes: 6 }]);
    await data.remove?.(['wm-x-v1']);
    expect(storage.data.has('wm-x-v1')).toBe(false);
    expect(data.storage).toEqual(['wm-x-v1']);
  });
});
