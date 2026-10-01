import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { ROOT_CLASS, SITE_LIKE_CLASS } from './classes';

// Une fonctionnalité en échec ne prive pas les autres des mutations suivantes.
const callbacks = createListeners(createLogger('dom'), 'observateur de DOM');
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

/** Mutation qui ne vient pas de nos propres interfaces (`.wm-root`), ou d'un contenu à nous au balisage du site. */
function isForeign(record: MutationRecord): boolean {
  const target = record.target instanceof Element ? record.target : record.target.parentElement;
  const owner = target?.closest(`.${ROOT_CLASS}, .${SITE_LIKE_CLASS}`);
  if (!owner || owner.classList.contains(SITE_LIKE_CLASS)) return true;
  // Un contenu au balisage du site est souvent construit hors du document puis inséré d'un coup dans notre racine.
  const siteLike = `.${SITE_LIKE_CLASS}`;
  return [...record.addedNodes].some((node) => node instanceof Element && (node.matches(siteLike) || node.querySelector(siteLike) !== null));
}

function schedule(): void {
  if (scheduled) return;
  scheduled = true;
  requestAnimationFrame(() => {
    scheduled = false;
    rounds++;
    callbacks.emit();
  });
}

/**
 * Appelle `callback` après chaque vague de changements du DOM du site, une fois par image au plus. Un seul
 * `MutationObserver` pour tout le script ; nos propres interfaces (`.wm-root`) sont ignorées, sauf leurs contenus au
 * balisage du site (`SITE_LIKE_CLASS`). Une inscription demande aussi une passe à l'image suivante, qui rappelle
 * tous les rappels inscrits, pas seulement le nouveau : `callback` doit être idempotent (« la page est-elle comme
 * elle doit être ? sinon la remettre »). À inscrire après `whenBody` : avant `<html>`, l'observateur ne peut pas
 * être créé et `observe` lève.
 */
export function watchDom(callback: () => void, options: { signal: AbortSignal }): void {
  const { signal } = options;
  if (signal.aborted) return;
  if (!observer) {
    const created = new MutationObserver((records) => {
      if (records.some(isForeign)) schedule();
    });
    created.observe(document.documentElement, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['class', 'disabled', 'aria-label'],
    });
    observer = created;
  }
  // Inscrit seulement une fois l'observateur en place : si `observe` a levé, rien ne reste derrière.
  callbacks.on(callback, { signal });
  signal.addEventListener(
    'abort',
    () => {
      if (callbacks.size > 0) return;
      observer?.disconnect();
      observer = undefined;
    },
    { once: true },
  );
  schedule();
}
