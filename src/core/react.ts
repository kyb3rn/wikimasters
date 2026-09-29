/** Nœud interne de React (« fiber ») : seulement ce qu'on en lit. */
export interface Fiber {
  readonly return: Fiber | null;
  readonly memoizedProps: unknown;
}

/** Fiber d'un élément rendu par React (propriété `__reactFiber$…`), s'il y en a un. */
export function fiberOf(element: Element): Fiber | undefined {
  const record = element as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.startsWith('__reactFiber$')) return record[key] as Fiber;
  }
  return undefined;
}

/**
 * Change la valeur d'un champ contrôlé par React. Une affectation de `value` ne suffit pas : React la
 * mémorise et n'y voit aucun changement. Il faut le setter natif, puis l'événement `input`.
 */
export function setReactInputValue(input: HTMLInputElement, value: string): void {
  if (input.value === value) return;
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')?.set?.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/** Le fiber et ses ancêtres, du plus proche au plus lointain (au plus `limit`). */
export function* fiberAncestors(fiber: Fiber | undefined, limit = 2000): Generator<Fiber> {
  let current: Fiber | null | undefined = fiber;
  for (let depth = 0; current && depth < limit; depth++) {
    yield current;
    current = current.return;
  }
}
