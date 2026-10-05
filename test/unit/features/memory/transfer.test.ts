import { describe, expect, it } from 'vitest';
import { parseExport, type DataSet } from '@/core/data';
import { applyImport, buildExport, planImport } from '@/features/memory/transfer';

const counts = { added: 1, updated: 0, unchanged: 0, invalid: 0 };

/** Donnée imitée : son contenu exporté, et chaque fusion demandée (contenu, appliquée ou non). */
function fakeSet(id: string, content: unknown, transfer = true): DataSet & { readonly merges: [unknown, boolean][] } {
  const merges: [unknown, boolean][] = [];
  return {
    id,
    name: id,
    tab: 'Onglet',
    description: '',
    storage: [],
    merges,
    list: () => Promise.resolve([]),
    ...(transfer && {
      transfer: {
        dump: () => Promise.resolve(content),
        merge: (raw: unknown, apply: boolean) => {
          merges.push([raw, apply]);
          return Promise.resolve(raw === 'illisible' ? undefined : counts);
        },
      },
    }),
  };
}

describe('export et import de la Mémoire', () => {
  it('le fichier contient chaque donnée exportable sous son id', async () => {
    const file = await buildExport([fakeSet('a', [1]), fakeSet('b', { x: 1 }), fakeSet('c', 'non', false)], 1000, '0.6.0');
    expect(parseExport(JSON.parse(JSON.stringify(file)))).toEqual({ script: '0.6.0', exportedAt: 1000, data: { a: [1], b: { x: 1 } } });
  });

  it('aperçu sans rien écrire : donnée inconnue ignorée, contenu illisible signalé', async () => {
    const known = fakeSet('a', null);
    const broken = fakeSet('b', null);
    const rows = await planImport({ script: '', exportedAt: 0, data: { a: [1], b: 'illisible', zzz: {} } }, [known, broken]);
    expect(rows).toEqual([
      { id: 'a', set: known, counts },
      { id: 'b', set: broken, counts: undefined },
      { id: 'zzz', set: undefined, counts: undefined },
    ]);
    expect(known.merges).toEqual([[[1], false]]);
  });

  it('applique seulement les données choisies', async () => {
    const chosen = fakeSet('a', null);
    const left = fakeSet('b', null);
    expect(await applyImport({ script: '', exportedAt: 0, data: { a: [1], b: [2] } }, [chosen])).toEqual([counts]);
    expect(chosen.merges).toEqual([[[1], true]]);
    expect(left.merges).toEqual([]);
  });
});
