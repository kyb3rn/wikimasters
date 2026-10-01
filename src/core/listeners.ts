import { createLogger, type Logger } from './log';

/** Liste d'abonnés prévenus ensemble (`emit`), chacun retiré à l'interruption de son signal. */
export interface Listeners<A extends unknown[] = []> {
  /** Rien si le signal est déjà interrompu ; l'abonné est retiré à son interruption. */
  on(listener: (...args: A) => void, options?: { signal?: AbortSignal }): void;
  /**
   * Prévient les abonnés inscrits à cet instant, dans l'ordre d'inscription. Une erreur est journalisée et les
   * suivants sont prévenus quand même ; un abonné retiré entre-temps (signal interrompu par un autre) ne l'est plus.
   */
  emit(...args: A): void;
  readonly size: number;
}

const defaultLog = createLogger();

/** `label` nomme les abonnés dans le journal d'une erreur (« <label> en échec »). */
export function createListeners<A extends unknown[] = []>(log: Logger = defaultLog, label = 'abonné'): Listeners<A> {
  // Une entrée par inscription : la même fonction inscrite deux fois est retirée par chacun de ses signaux.
  const entries = new Set<{ readonly listener: (...args: A) => void }>();

  return {
    on(listener, options) {
      const signal = options?.signal;
      if (signal?.aborted) return;
      const entry = { listener };
      entries.add(entry);
      signal?.addEventListener('abort', () => entries.delete(entry), { once: true });
    },
    emit(...args) {
      for (const entry of [...entries]) {
        if (!entries.has(entry)) continue;
        try {
          entry.listener(...args);
        } catch (error) {
          log.error(`${label} en échec`, error);
        }
      }
    },
    get size() {
      return entries.size;
    },
  };
}
