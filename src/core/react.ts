import { isRecord } from '@/core/guards';

/** Nœud interne de React (« fiber ») : seulement ce qu'on en lit. */
export interface Fiber {
  readonly return: Fiber | null;
  readonly memoizedProps: unknown;
  /** Clé de l'élément dans sa liste (`key`), souvent l'id de ce qu'il affiche. */
  readonly key?: string | null;
  readonly child?: Fiber | null;
  readonly sibling?: Fiber | null;
  /** Élément du DOM, racine de React (`{ current }`, sur le fiber sans `return`), instance… */
  readonly stateNode?: unknown;
  /** Composant fonction : son premier hook (liste chaînée par `next`). */
  readonly memoizedState?: unknown;
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

/** État d'un composant (`useState`, `useReducer`) : sa valeur et de quoi la changer. */
export interface StateHook {
  readonly value: unknown;
  readonly set: (value: unknown) => void;
}

/**
 * États d'un composant fonction, dans l'ordre de ses appels. Ses hooks forment une liste chaînée ; seuls
 * les hooks d'état ont une file avec `dispatch` (les effets, `useRef`, `useMemo` n'en ont pas). Lire le
 * fiber de l'arbre affiché (`currentFiberAncestors`) : l'autre version peut garder d'anciennes valeurs.
 */
export function stateHooks(fiber: Fiber, limit = 500): StateHook[] {
  const states: StateHook[] = [];
  let hook = fiber.memoizedState;
  for (let count = 0; isRecord(hook) && count < limit; count++) {
    const queue = hook.queue;
    if (isRecord(queue) && typeof queue.dispatch === 'function') {
      const dispatch = queue.dispatch as (value: unknown) => void;
      states.push({ value: hook.memoizedState, set: (value) => dispatch(value) });
    }
    hook = hook.next;
  }
  return states;
}

interface DomNodeLike {
  contains(other: unknown): boolean;
}

function isDomNode(value: unknown): value is DomNodeLike {
  return isRecord(value) && 'nodeType' in value && typeof value.contains === 'function';
}

function isFiber(value: unknown): value is Fiber {
  return isRecord(value) && 'memoizedProps' in value && 'return' in value;
}

/**
 * Ancêtres d'un élément dans l'arbre affiché, du plus proche au plus lointain. React garde deux versions
 * de chaque fiber et ne met pas à jour celui noté sur le nœud du DOM : lui et ses `return` peuvent être
 * ceux du rendu précédent (props périmées, rappels qui liraient un ancien état). On redescend donc depuis
 * la racine affichée (`stateNode.current` du fiber racine) jusqu'à l'élément. Sans racine lisible : les
 * ancêtres notés (`fiberAncestors`).
 */
export function currentFiberAncestors(element: Element, limit = 100_000): Fiber[] {
  const noted = fiberOf(element);
  let top: Fiber | undefined;
  for (const fiber of fiberAncestors(noted)) top = fiber;
  const root = isRecord(top?.stateNode) ? top.stateNode.current : undefined;
  return (isFiber(root) ? pathTo(root, element, limit) : undefined) ?? [...fiberAncestors(noted)];
}

/** Du fiber de `target` à la racine, en parcourant l'arbre depuis `root` (sans entrer dans le DOM qui ne le contient pas). */
function pathTo(root: Fiber, target: Element, limit: number): Fiber[] | undefined {
  const parents: Fiber[] = [];
  let fiber: Fiber | null | undefined = root;
  for (let steps = 0; fiber && steps < limit; steps++) {
    const node = fiber.stateNode;
    if (node === target) return [fiber, ...parents.reverse()];
    if (fiber.child && (!isDomNode(node) || node.contains(target))) {
      parents.push(fiber);
      fiber = fiber.child;
      continue;
    }
    while (fiber && !fiber.sibling) fiber = parents.pop();
    fiber = fiber?.sibling;
  }
  return undefined;
}
