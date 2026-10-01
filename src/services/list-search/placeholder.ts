/** Texte d'aide des champs de recherche des listes (Collection, Toutes les cartes, marché, échanges…). */
export const SEARCH_PLACEHOLDER = 'Rechercher par nom ou description';

/** Champs dont le texte d'aide est le nôtre, par signal : remis à leur texte d'origine à son interruption. */
const applied = new WeakMap<AbortSignal, Set<HTMLInputElement>>();

function restore(field: HTMLInputElement): void {
  const original = field.dataset.wmPlaceholder;
  if (original === undefined) return;
  if (field.placeholder === SEARCH_PLACEHOLDER) field.placeholder = original;
  delete field.dataset.wmPlaceholder;
}

/**
 * Pose notre texte d'aide sur un champ de recherche du site, en gardant le sien (`data-wm-placeholder`), remis à
 * l'interruption de `signal`. Idempotent : n'écrit rien si le champ l'a déjà (rappel de `watchDom`) ; si React
 * réécrit le sien, il est repris comme nouvel original.
 */
export function applySearchPlaceholder(field: HTMLInputElement, signal: AbortSignal): void {
  if (signal.aborted) return;
  // React ne réécrit le texte d'aide que s'il change de son côté.
  if (field.placeholder !== SEARCH_PLACEHOLDER) {
    field.dataset.wmPlaceholder = field.placeholder;
    field.placeholder = SEARCH_PLACEHOLDER;
  }
  let fields = applied.get(signal);
  if (!fields) {
    const created = new Set<HTMLInputElement>();
    fields = created;
    applied.set(signal, created);
    signal.addEventListener(
      'abort',
      () => {
        for (const each of created) restore(each);
        created.clear();
      },
      { once: true },
    );
  }
  if (fields.has(field)) return;
  // Les champs que React a remplacés ne sont plus à remettre.
  for (const old of fields) if (!old.isConnected) fields.delete(old);
  fields.add(field);
}
