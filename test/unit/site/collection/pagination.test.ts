import { describe, expect, it } from 'vitest';
import { pageSetterAmong } from '@/site/collection/pagination';
import { stateComponent, statelessFiber } from '../../support';

describe('pageSetterAmong', () => {
  // Page Collection : liste, total (120 exemplaires), chargement, page 2 (index 1).
  const page = () => stateComponent({}, [], 120, false, 1);

  it('change l’état de la page du composant au-dessus du « tirer pour rafraîchir »', () => {
    const collection = page();
    // Le « tirer pour rafraîchir » a lui aussi un état numérique (distance tirée) : ignoré.
    const refresh = stateComponent({ onRefresh: () => {} }, 1);
    const setPage = pageSetterAmong([statelessFiber(), statelessFiber(), refresh.fiber, collection.fiber], 1);
    setPage?.(3);
    expect(collection.calls).toEqual([[], [], [], [3]]);
    expect(refresh.calls).toEqual([[]]);
  });

  it('état ambigu, absent ou sans « tirer pour rafraîchir » : rien', () => {
    const refresh = stateComponent({ onRefresh: () => {} }).fiber;
    expect(pageSetterAmong([refresh, stateComponent({}, 1, 1).fiber], 1)).toBeUndefined();
    expect(pageSetterAmong([refresh, page().fiber], 4)).toBeUndefined();
    expect(pageSetterAmong([statelessFiber(), page().fiber], 1)).toBeUndefined();
  });
});
