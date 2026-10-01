import { describe, expect, it } from 'vitest';
import { pageStatesAmong, recountTagOptions, retagEntries } from '@/site/collection/page-state';
import { stateComponent } from '../../support';

const rare = { id: 't1', name: 'rare', color: '#f472b6' };
const sport = { id: 't2', name: 'sport', color: '#60a5fa' };
const card = (id: string, tags: object[] = []) => ({ id, card: { id: `c-${id}` }, tags, count: 1 });

describe('étiquettes posées ou retirées sur les exemplaires affichés', () => {
  it('ajout : sur les exemplaires choisis seulement, sans doublon, couleur connue reprise', () => {
    const u1 = card('u1', [rare]);
    const u3 = card('u3');
    const known = new Map([['t2', { id: 't2', name: 'sport', color: '#60a5fa' }]]);
    const next = retagEntries([u1, card('u2'), u3], { cardIds: ['u1', 'u2'], add: [rare, { id: 't2', name: 'sport' }] }, known);
    expect(next).toEqual([card('u1', [rare, sport]), card('u2', [rare, sport]), u3]);
    expect(next[2]).toBe(u3);
  });

  it('retrait', () => {
    const next = retagEntries([card('u1', [rare, sport]), card('u2', [rare])], { cardIds: ['u1', 'u2'], remove: ['t1'] }, new Map());
    expect(next).toEqual([card('u1', [sport]), card('u2')]);
  });

  it('compteurs : chaque exemplaire qui gagne ou perd l’étiquette ; une nouvelle y entre', () => {
    const entries = [card('u1', [rare]), card('u2'), card('u3', [rare])];
    const options = [{ ...rare, cardCount: 5 }];
    const fresh = { id: 'n1', name: 'Nouvelle', color: '#4ade80' };
    expect(recountTagOptions(options, entries, { cardIds: ['u1', 'u2'], add: [rare, fresh] })).toEqual([
      { ...rare, cardCount: 6 },
      { ...fresh, cardCount: 2 },
    ]);
    expect(recountTagOptions(options, entries, { cardIds: ['u1', 'u2', 'u3'], remove: ['t1'] })).toEqual([{ ...rare, cardCount: 3 }]);
  });
});

describe('états de la page', () => {
  const refresh = stateComponent({ onRefresh: () => {} }, 0).fiber;

  it('exemplaires, total, compteurs, catalogue : les premiers états de la page', () => {
    const states = pageStatesAmong([refresh, stateComponent({}, [card('u1')], 1, [], null, new Set()).fiber]);
    expect(states?.list.value).toEqual([card('u1')]);
    expect(states?.catalog.value).toBeNull();
  });

  it('forme inattendue : rien', () => {
    expect(pageStatesAmong([refresh, stateComponent({}, [{ id: 'x' }], 1, [], null).fiber])).toBeUndefined();
    expect(pageStatesAmong([refresh, stateComponent({}, [], '1', [], null).fiber])).toBeUndefined();
    expect(pageStatesAmong([stateComponent({}, [], 1, [], null).fiber])).toBeUndefined();
  });
});
