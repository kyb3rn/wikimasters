import { describe, expect, it } from 'vitest';
import type { Fiber } from '@/core/react';
import { readPageLabel } from '@/site/collection';
import { pageSetterAmong } from '@/site/collection/pagination';

describe('readPageLabel', () => {
  it('lit « Page x / y »', () => {
    expect(readPageLabel('Page 3 / 29')).toEqual({ page: 3, total: 29 });
    expect(readPageLabel(' Page 1 /  2 ')).toEqual({ page: 1, total: 2 });
  });

  it('rien pendant un chargement', () => {
    expect(readPageLabel('Chargement…')).toBeUndefined();
    expect(readPageLabel('')).toBeUndefined();
  });
});

/** Composant à états imité : ses hooks d'état, dans l'ordre (valeur, appels reçus). */
function component(props: unknown, ...values: unknown[]) {
  const calls: unknown[][] = values.map(() => []);
  const memoizedState = values.reduceRight<unknown>(
    (next, value, i) => ({ memoizedState: value, queue: { dispatch: (state: unknown) => calls[i]?.push(state) }, next }),
    null,
  );
  const fiber: Fiber = { memoizedProps: props, return: null, memoizedState };
  return { fiber, calls };
}

const host = (): Fiber => ({ memoizedProps: {}, return: null });

describe('pageSetterAmong', () => {
  // Page Collection : liste, total (120 exemplaires), chargement, page 2 (index 1).
  const page = () => component({}, [], 120, false, 1);

  it('change l’état de la page du composant au-dessus du « tirer pour rafraîchir »', () => {
    const collection = page();
    // Le « tirer pour rafraîchir » a lui aussi un état numérique (distance tirée) : ignoré.
    const refresh = component({ onRefresh: () => {} }, 1);
    const setPage = pageSetterAmong([host(), host(), refresh.fiber, collection.fiber], 1);
    setPage?.(3);
    expect(collection.calls).toEqual([[], [], [], [3]]);
    expect(refresh.calls).toEqual([[]]);
  });

  it('état ambigu, absent ou sans « tirer pour rafraîchir » : rien', () => {
    const refresh = component({ onRefresh: () => {} }).fiber;
    expect(pageSetterAmong([refresh, component({}, 1, 1).fiber], 1)).toBeUndefined();
    expect(pageSetterAmong([refresh, page().fiber], 4)).toBeUndefined();
    expect(pageSetterAmong([host(), page().fiber], 1)).toBeUndefined();
  });
});
