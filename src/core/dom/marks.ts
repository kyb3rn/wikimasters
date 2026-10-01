import { setClass } from './classes';

/** Taille à partir de laquelle les éléments retirés de la page sont oubliés (doublée après chaque tri). */
const PRUNE_AT = 64;

/** Classes posées sur des éléments du site, retenues pour être retirées ensemble. */
export interface ClassMarks {
  /** `setClass`, en retenant l'élément marqué. */
  set(element: Element, name: string, on: boolean): void;
  /** La classe exactement sur `targets` : posée sur eux, retirée des autres éléments que ces marques en avaient. */
  only(name: string, targets: Iterable<Element>): void;
}

interface Marked {
  readonly elements: Set<Element>;
  pruneAt: number;
}

/** À l'interruption de `signal`, chaque classe est retirée des seuls éléments que ces marques ont marqués. */
export function classMarks(signal: AbortSignal): ClassMarks {
  const marked = new Map<string, Marked>();
  const markedOf = (name: string) => {
    let entry = marked.get(name);
    if (!entry) marked.set(name, (entry = { elements: new Set(), pruneAt: PRUNE_AT }));
    return entry;
  };

  signal.addEventListener(
    'abort',
    () => {
      for (const [name, { elements }] of marked) for (const element of elements) setClass(element, name, false);
      marked.clear();
    },
    { once: true },
  );

  return {
    set(element, name, on) {
      if (signal.aborted) return;
      setClass(element, name, on);
      if (!on) {
        marked.get(name)?.elements.delete(element);
        return;
      }
      const entry = markedOf(name);
      entry.elements.add(element);
      // Une fonctionnalité de toutes les pages marque sans fin des nœuds que React retire ensuite : sans ce tri,
      // ils resteraient en mémoire jusqu'au démontage.
      if (entry.elements.size > entry.pruneAt) {
        for (const kept of entry.elements) if (!kept.isConnected) entry.elements.delete(kept);
        entry.pruneAt = Math.max(PRUNE_AT, entry.elements.size * 2);
      }
    },
    only(name, targets) {
      if (signal.aborted) return;
      const wanted = new Set(targets);
      const { elements } = markedOf(name);
      for (const element of elements) {
        if (wanted.has(element)) continue;
        setClass(element, name, false);
        elements.delete(element);
      }
      for (const element of wanted) {
        setClass(element, name, true);
        elements.add(element);
      }
    },
  };
}
