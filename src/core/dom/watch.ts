import { createLogger } from '@/core/log';
import { ROOT_CLASS } from './ready';

type Callback = () => void;

const log = createLogger('dom');

const callbacks = new Set<Callback>();
let observer: MutationObserver | undefined;
let scheduled = false;
let rounds = 0;

/**
 * Nombre de passes de synchronisation depuis le chargement. Au repos, il ne doit plus augmenter :
 * sinon un rappel modifie le DOM à chaque passe (boucle), ce que vérifient les tests.
 */
export function domSyncRounds(): number {
  return rounds;
}

/** Mutation qui ne vient pas de nos propres interfaces (`.wm-root`). */
function isForeign(record: MutationRecord): boolean {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  return !target?.closest(`.${ROOT_CLASS}`);
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    rounds++;
    for (const callback of [...callbacks]) {
      try {
        callback();
      } catch (error) {
        // Une fonctionnalité en échec ne doit pas priver les autres des mutations suivantes.
        log.error('observateur de DOM en échec', error);
      }
    }
  });
}

/**
 * Appelle `callback` après chaque vague de changements du DOM du site (une fois par image au plus),
 * et une première fois tout de suite après l'inscription. Un seul `MutationObserver` pour tout le
 * script ; nos propres interfaces (`.wm-root`) sont ignorées. `callback` doit être idempotent :
 * « la page est-elle comme elle doit être ? sinon la remettre ».
 */
export function watchDom(callback: Callback, options: { signal: AbortSignal }): void {
  const { signal } = options;
  if (signal.aborted) return;
  callbacks.add(callback);
  if (!observer) {
    observer = new MutationObserver((records) => {
      if (records.some(isForeign)) schedule();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled', 'aria-label'],
    });
  }
  signal.addEventListener(
    'abort',
    () => {
      callbacks.delete(callback);
      if (callbacks.size === 0) {
        observer?.disconnect();
        observer = undefined;
      }
    },
    { once: true },
  );
  schedule();
}
