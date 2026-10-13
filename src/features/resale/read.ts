import { useRef, useState } from 'preact/hooks';
import type { Logger } from '@/core/log';
import { siteErrorText } from '@/site/api';
import { toast } from '@/ui/toast';

/** Lecture d'une section de la page, à part de l'autre : un échec n'empêche pas l'autre de s'afficher. */
export interface SectionRead<T> {
  /** Liste lue ; jamais lue : `undefined`. */
  readonly list: readonly T[] | undefined;
  /** Jamais lue, la dernière lecture en échec : son message, à la place de la liste. */
  readonly error: string | undefined;
  /** Dernière lecture en échec, la liste d'avant restée affichée. */
  readonly stale: boolean;
  readonly loading: boolean;
  /** Nouvelle lecture ; celle en cours est abandonnée. */
  load(): Promise<void>;
}

export interface SectionReadOptions<T> {
  readonly signal: AbortSignal;
  readonly log: Logger;
  /** Titre de la section (journal, toast d'un rechargement en échec). */
  readonly name: string;
  readonly read: () => Promise<readonly T[]>;
  /** Liste lue, juste avant d'être affichée. */
  readonly onRead: (list: readonly T[]) => void;
}

/** Lue dès l'arrivée (`loading` vrai d'emblée) : la page appelle `load` une fois montée. */
export function useSectionRead<T>(options: SectionReadOptions<T>): SectionRead<T> {
  const [list, setList] = useState<readonly T[]>();
  const [error, setError] = useState<string>();
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(true);
  const run = useRef(0);
  // Rappels et liste du dernier rendu : une lecture finit après plusieurs rendus.
  const latest = useRef({ options, list });
  latest.current = { options, list };

  async function load(): Promise<void> {
    const id = ++run.current;
    const { signal, log, name, read } = latest.current.options;
    setLoading(true);
    try {
      const next = await read();
      if (id !== run.current || signal.aborted) return;
      latest.current.options.onRead(next);
      setList(next);
      setError(undefined);
      setStale(false);
    } catch (reason) {
      if (id !== run.current || signal.aborted) return;
      log.warn(`« ${name} » non lue`, reason);
      if (latest.current.list === undefined) {
        setError(siteErrorText(reason));
      } else {
        setStale(true);
        toast.error(siteErrorText(reason), { title: `Revente · ${name}` });
      }
    } finally {
      if (id === run.current) setLoading(false);
    }
  }

  return { list, error, stale, loading, load };
}
