import { useEffect, useRef, useState } from 'preact/hooks';
import type { DataItem, DataSet } from '@/core/data';
import type { Logger } from '@/core/log';

/** Liste d'une donnée : en lecture, lue, ou en échec (la dernière lue reste). */
export interface ListState {
  readonly items?: readonly DataItem[];
  readonly loading: boolean;
  readonly failed: boolean;
}

export interface DataLists {
  state(id: string): ListState;
  /** Relit ces données (après une suppression, un import). */
  reload(sets: readonly DataSet[]): Promise<void>;
}

const LOADING: ListState = { loading: true, failed: false };

/** Les listes de toutes les données, lues à l'ouverture de la fenêtre puis à la demande. */
export function useDataLists(sets: readonly DataSet[], log: Logger): DataLists {
  const [states, setStates] = useState<ReadonlyMap<string, ListState>>(new Map());
  const mounted = useRef(true);
  useEffect(
    () => () => {
      mounted.current = false;
    },
    [],
  );

  const patch = (id: string, change: (current: ListState) => ListState) =>
    setStates((current) => new Map(current).set(id, change(current.get(id) ?? LOADING)));

  async function reload(targets: readonly DataSet[]): Promise<void> {
    for (const set of targets) patch(set.id, (current) => ({ ...current, loading: true }));
    await Promise.all(
      targets.map(async (set) => {
        try {
          const items = await set.list();
          if (mounted.current) patch(set.id, () => ({ items, loading: false, failed: false }));
        } catch (error) {
          log.warn(`« ${set.name} » illisible`, error);
          if (mounted.current) patch(set.id, (current) => ({ ...current, loading: false, failed: true }));
        }
      }),
    );
  }

  useEffect(() => {
    void reload(sets);
  }, [sets]);

  return { state: (id) => states.get(id) ?? LOADING, reload };
}
