import { describe, expect, it } from 'vitest';
import { globalCollectionStatesAmong } from '@/site/global-collection/state';
import { stateComponent, statelessFiber } from '../../support';

describe('globalCollectionStatesAmong', () => {
  // Page du catalogue (code du site) : …, champ de recherche, tri, raretés, page, carte ouverte, recherche en cours.
  const page = () => stateComponent({}, [], 1200, false, {}, false, null, false, 'name', 'rarity', new Set(['L']), 2, null, 'name');

  it('tri reconnu à sa valeur, suivi des raretés et de la page', () => {
    const catalog = page();
    const states = globalCollectionStatesAmong([statelessFiber(), statelessFiber(), catalog.fiber], 'rarity');
    expect(states?.page.value).toBe(2);
    states?.page.set(5);
    states?.rarities.set(new Set());
    expect(catalog.calls[10]).toEqual([5]);
    expect(catalog.calls[9]).toEqual([new Set()]);
  });

  it('tri introuvable ou ambigu : rien', () => {
    expect(globalCollectionStatesAmong([page().fiber], 'atk')).toBeUndefined();
    expect(globalCollectionStatesAmong([stateComponent({}, 'rarity', new Set(), 0, 'rarity', new Set(), 1).fiber], 'rarity')).toBeUndefined();
  });
});
