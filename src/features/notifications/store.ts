import { useEffect, useState } from 'preact/hooks';
import type { Entry } from './entries';

/** Ce que montrent la cloche et sa liste. */
export interface CenterState {
  readonly entries: readonly Entry[];
  readonly unread: number;
  /** Cloche qui a ouvert la liste (celle de la barre mobile ou de la boîte ordinateur). */
  readonly anchor?: HTMLElement;
  /** « Tout marquer comme lu » attend la réponse du site. */
  readonly marking: boolean;
}

export interface CenterStore {
  get(): CenterState;
  set(change: Partial<CenterState>): void;
  subscribe(listener: () => void): () => void;
}

export function createCenterStore(): CenterStore {
  let state: CenterState = { entries: [], unread: 0, marking: false };
  const listeners = new Set<() => void>();
  return {
    get: () => state,
    set(change) {
      state = { ...state, ...change };
      listeners.forEach((listener) => listener());
    },
    subscribe(listener) {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
  };
}

export function useCenter(store: CenterStore): CenterState {
  const [state, setState] = useState(() => store.get());
  useEffect(() => {
    setState(store.get());
    return store.subscribe(() => setState(store.get()));
  }, [store]);
  return state;
}
