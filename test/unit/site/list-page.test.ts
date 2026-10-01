import { describe, expect, it, vi } from 'vitest';
import { stateHooks } from '@/core/react';
import { refreshAbove, renewSet, statesAboveRefresh, uniqueStateRun } from '@/site/list-page';
import { stateComponent, statelessFiber } from '../support';

const refresh = (onRefresh: () => unknown = () => {}) => stateComponent({ onRefresh }, 0);
const isNumber = (value: unknown) => typeof value === 'number';
const isText = (value: unknown) => typeof value === 'string';

describe('refreshAbove', () => {
  it('actualisation du « tirer pour rafraîchir » au-dessus du nœud ; sans lui : rien', () => {
    const onRefresh = vi.fn();
    const node = { nodeType: 1, contains: () => false, __reactFiber$x: { memoizedProps: {}, return: refresh(onRefresh).fiber } };
    refreshAbove(node as unknown as Node)?.();
    expect(onRefresh).toHaveBeenCalledTimes(1);
    const alone = { nodeType: 1, contains: () => false, __reactFiber$x: statelessFiber() };
    expect(refreshAbove(alone as unknown as Node)).toBeUndefined();
  });
});

describe('statesAboveRefresh', () => {
  it('états du premier composant à états au-dessus du « tirer pour rafraîchir », pas les siens', () => {
    const page = stateComponent({}, [], 12);
    const states = statesAboveRefresh([statelessFiber(), refresh().fiber, statelessFiber(), page.fiber, stateComponent({}, 'x').fiber]);
    expect(states?.map((state) => state.value)).toEqual([[], 12]);
  });

  it('sans « tirer pour rafraîchir », ou rien d’état au-dessus : rien', () => {
    expect(statesAboveRefresh([statelessFiber(), stateComponent({}, [], 12).fiber])).toBeUndefined();
    expect(statesAboveRefresh([stateComponent({}, [], 12).fiber, refresh().fiber, statelessFiber()])).toBeUndefined();
  });
});

describe('uniqueStateRun', () => {
  it('la seule suite d’états qui passe les tests, dans le premier composant à états', () => {
    const page = stateComponent({}, true, 'name', 3, 'x', null);
    const run = uniqueStateRun([statelessFiber(), page.fiber], [isText, isNumber]);
    expect(run?.map((state) => state.value)).toEqual(['name', 3]);
    run?.[1]?.set(4);
    expect(page.calls[2]).toEqual([4]);
  });

  it('suite absente ou répétée : rien, sans chercher plus haut', () => {
    expect(uniqueStateRun([stateComponent({}, 'a', 1, 'b', 2).fiber], [isText, isNumber])).toBeUndefined();
    const later = stateComponent({}, 'name', 3).fiber;
    expect(uniqueStateRun([stateComponent({}, true).fiber, later], [isText, isNumber])).toBeUndefined();
    expect(uniqueStateRun([statelessFiber()], [isText])).toBeUndefined();
  });
});

describe('renewSet', () => {
  it('ensemble remplacé par un autre de même contenu ; autre valeur : rien', () => {
    const rarities = new Set(['L', 'SR']);
    const page = stateComponent({}, rarities, 'name');
    const [set, text] = stateHooks(page.fiber);
    if (!set || !text) throw new Error('états attendus');
    renewSet(set);
    renewSet(text);
    const [renewed] = page.calls[0] ?? [];
    expect(renewed).not.toBe(rarities);
    expect(renewed).toEqual(rarities);
    expect(page.calls[1]).toEqual([]);
  });
});
