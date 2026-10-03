import { useEffect, useState } from 'preact/hooks';
import type { NotificationCategory } from './categories';
import type { Entry } from './entries';
import type { FriendRequests } from './friend-requests';
import type { RemovedWishes } from './wishlist';

/** Ce que montrent la cloche et sa liste. */
export interface CenterState {
  readonly entries: readonly Entry[];
  readonly unread: number;
  /** Cloche qui a ouvert la liste (celle de la barre mobile ou de la boîte ordinateur). */
  readonly anchor?: HTMLElement;
  /** « Tout marquer comme lu » attend la réponse du site. */
  readonly marking: boolean;
  /** Cartes retirées de ma liste de souhaits (`wishedIn`). */
  readonly removed: RemovedWishes;
  /** Cartes ajoutées ou retirées de la liste de souhaits, en attente de la réponse du site. */
  readonly wishing: ReadonlySet<string>;
  /** Demandes d'ami arrivées sous les yeux du script, par notification. */
  readonly friendRequests: FriendRequests;
  /** Réponses aux demandes d'ami en attente du site, par notification. */
  readonly answering: ReadonlyMap<string, FriendAnswer>;
  /** Catégories cochées dans la liste ; aucune : toutes. */
  readonly filter: ReadonlySet<NotificationCategory>;
}

export type FriendAnswer = 'accept' | 'decline';

export interface CenterStore {
  get(): CenterState;
  set(change: Partial<CenterState>): void;
  subscribe(listener: () => void): () => void;
}

export function createCenterStore(): CenterStore {
  let state: CenterState = { entries: [], unread: 0, marking: false, removed: {}, wishing: new Set(), friendRequests: {}, answering: new Map(), filter: new Set() };
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
