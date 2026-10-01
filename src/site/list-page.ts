import { isRecord, isSet } from '@/core/guards';
import { findPropsAbove, stateHooks, type Fiber, type StateHook } from '@/core/react';

/*
 * Pages de listes du site (Collection, Toutes les cartes, marché, collection d'un ami ; code du 29 et 30/09/2026) :
 * la Collection et le marché sont entourés d'un composant « tirer pour rafraîchir » dont le rappel `onRefresh`
 * actualise la page ; leurs filtres, leur page et leur liste sont des états React de la page.
 */

const hasRefresh = (props: unknown) => isRecord(props) && typeof props.onRefresh === 'function';

/**
 * Actualisation de la page (rappel `onRefresh` du « tirer pour rafraîchir » au-dessus de `node`, lu dans l'arbre
 * React affiché : celui d'un rendu précédent chargerait les anciens filtres). Elle part aussitôt : ses requêtes
 * sont lancées pendant l'appel.
 */
export function refreshAbove(node: Node): (() => unknown) | undefined {
  const refresh = findPropsAbove(node, hasRefresh)?.props.onRefresh as (() => unknown) | undefined;
  return refresh && (() => refresh());
}

/**
 * États de la page qu'entoure le « tirer pour rafraîchir » : premier composant à états au-dessus de lui parmi
 * `ancestors` (du plus proche au plus lointain). Rien sans lui.
 */
export function statesAboveRefresh(ancestors: readonly Fiber[]): StateHook[] | undefined {
  const refresh = ancestors.findIndex((fiber) => hasRefresh(fiber.memoizedProps));
  if (refresh < 0) return undefined;
  for (const fiber of ancestors.slice(refresh + 1)) {
    const states = stateHooks(fiber);
    if (states.length > 0) return states;
  }
  return undefined;
}

/**
 * États consécutifs du premier composant à états parmi `ancestors`, chacun passant son test, dans l'ordre. Rien
 * si ce composant n'a pas exactement une telle suite.
 */
export function uniqueStateRun(ancestors: readonly Fiber[], tests: readonly ((value: unknown) => boolean)[]): StateHook[] | undefined {
  for (const fiber of ancestors) {
    const states = stateHooks(fiber);
    if (states.length === 0) continue;
    const runs = states.flatMap((_, start) => {
      const run = states.slice(start, start + tests.length);
      return run.length === tests.length && run.every((state, i) => tests[i]?.(state.value) === true) ? [run] : [];
    });
    const [only, ...others] = runs;
    return only && others.length === 0 ? only : undefined;
  }
  return undefined;
}

/** Un ensemble (`Set`) remplacé par un autre de même contenu : l'effet de la page qui en dépend relance sa liste, telle quelle. */
export function renewSet(state: StateHook): void {
  if (isSet(state.value)) state.set(new Set(state.value));
}
