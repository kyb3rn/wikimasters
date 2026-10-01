import { describe, expect, it } from 'vitest';
import { readBulkDiscard, readBulkDiscardFailures, selectionStateAmong } from '@/site/collection';
import { netRequest, stateComponent } from '../../support';

const request = (body: string | undefined, path = '/api/user-cards/bulk-discard') => netRequest(path, { method: 'POST', body });

describe('défausse de la sélection', () => {
  it('exemplaires demandés', () => {
    expect(readBulkDiscard(request('{"card_ids":["u1","u2"]}'))).toEqual(['u1', 'u2']);
  });

  it('autre requête, corps absent ou illisible : aucun', () => {
    expect(readBulkDiscard(request('{"card_ids":["u1"]}', '/api/user-cards/u1/discard'))).toEqual([]);
    expect(readBulkDiscard(request(undefined))).toEqual([]);
    expect(readBulkDiscard(request('pas du json'))).toEqual([]);
    expect(readBulkDiscard(request('{"card_ids":["u1",3]}'))).toEqual(['u1']);
  });

  it('échecs : identifiants ou objets, forme inconnue ignorée', () => {
    expect(readBulkDiscardFailures({ discarded_count: 2, failed: [] })).toEqual([]);
    expect(readBulkDiscardFailures({ failed: ['u1', { user_card_id: 'u2' }, { card_id: 'u3' }, { id: 'u4' }, { error: 'x' }, 5] })).toEqual([
      'u1',
      'u2',
      'u3',
      'u4',
    ]);
    expect(readBulkDiscardFailures(undefined)).toEqual([]);
  });
});

describe('mode sélection dans l’état de la page', () => {
  // Page : liste, total, raretés (Set), page, carte ouverte, sélection, cochés (Set), modale d'étiquetage.
  const page = (selecting: boolean) => stateComponent({}, [], 0, new Set(), 0, null, selecting, new Set(['u1']), false);
  const refresh = () => stateComponent({ onRefresh: () => {} }, 0).fiber;

  it('le booléen juste avant l’ensemble des cochés : lu, et changé avec la sélection vidée', () => {
    const collection = page(false);
    const state = selectionStateAmong([refresh(), collection.fiber]);
    expect(state?.active).toBe(false);
    state?.setActive(true);
    expect(collection.calls[5]).toEqual([true]);
    expect(collection.calls[6]).toEqual([new Set()]);
    expect(selectionStateAmong([refresh(), page(true).fiber])?.active).toBe(true);
  });

  it('ambigu, absent ou sans « tirer pour rafraîchir » : rien', () => {
    expect(selectionStateAmong([refresh(), stateComponent({}, false, new Set(), true, new Set()).fiber])).toBeUndefined();
    expect(selectionStateAmong([refresh(), stateComponent({}, [], 0, null).fiber])).toBeUndefined();
    expect(selectionStateAmong([page(false).fiber])).toBeUndefined();
  });
});
