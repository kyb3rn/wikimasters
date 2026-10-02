import { isRecord } from '@/core/guards';

/** Nœud interne de React (« fiber ») : seulement ce qu'on en lit. */
export interface Fiber {
  readonly return: Fiber | null;
  readonly memoizedProps: unknown;
  /** Composant, balise, ou contexte d'un fournisseur (`<Contexte value>`). */
  readonly type?: unknown;
  /** Clé de l'élément dans sa liste (`key`), souvent l'id de ce qu'il affiche. */
  readonly key?: string | null;
  readonly child?: Fiber | null;
  readonly sibling?: Fiber | null;
  /** Élément du DOM, racine de React (`{ current }`, sur le fiber sans `return`), instance… */
  readonly stateNode?: unknown;
  /** Composant fonction : son premier hook (liste chaînée par `next`). */
  readonly memoizedState?: unknown;
}

/** Fiber d'un nœud rendu par React (propriété `__reactFiber$…`), s'il y en a un. */
export function fiberOf(node: Node): Fiber | undefined {
  const record = node as unknown as Record<string, unknown>;
  for (const key of Object.keys(record)) {
    if (key.startsWith('__reactFiber$')) return record[key] as Fiber;
  }
  return undefined;
}

/**
 * Change la valeur d'un champ contrôlé par React. Une affectation de `value` ne suffit pas : React la
 * mémorise et n'y voit aucun changement. Il faut le setter natif, puis l'événement `input`.
 */
export function setReactInputValue(input: HTMLInputElement | HTMLTextAreaElement, value: string): void {
  if (input.value === value) return;
  const prototype = input instanceof HTMLTextAreaElement ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  Object.getOwnPropertyDescriptor(prototype, 'value')?.set?.call(input, value);
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

/**
 * Rappels mémorisés d'un composant fonction (`useCallback`), dans l'ordre de ses appels : hooks dont la valeur est
 * `[fonction, dépendances]`. Ils lisent l'état du composant par ses setters, stables d'un rendu à l'autre.
 */
export function callbackHooks(fiber: Fiber, limit = 500): ((...args: unknown[]) => unknown)[] {
  const callbacks: ((...args: unknown[]) => unknown)[] = [];
  let hook = fiber.memoizedState;
  for (let count = 0; isRecord(hook) && count < limit; count++) {
    const value: unknown = hook.memoizedState;
    if (Array.isArray(value) && value.length === 2 && typeof value[0] === 'function' && (value[1] === null || Array.isArray(value[1]))) {
      callbacks.push(value[0] as (...args: unknown[]) => unknown);
    }
    hook = hook.next;
  }
  return callbacks;
}

/** Valeurs des références d'un composant fonction (`useRef`), dans l'ordre de ses appels : hooks dont la valeur est `{ current }`. */
export function refHooks(fiber: Fiber, limit = 500): unknown[] {
  const refs: unknown[] = [];
  let hook = fiber.memoizedState;
  for (let count = 0; isRecord(hook) && count < limit; count++) {
    const value: unknown = hook.memoizedState;
    if (isRecord(value) && Object.keys(value).length === 1 && 'current' in value) refs.push(value.current);
    hook = hook.next;
  }
  return refs;
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
 * ancêtres notés (`fiberAncestors`). Un élément rendu en portail (modales du site, dans `body`) est sous un
 * nœud du DOM qui ne le contient pas : s'il n'est pas trouvé ainsi, l'arbre est parcouru en entier.
 */
export function currentFiberAncestors(node: Node, limit = 100_000): Fiber[] {
  const noted = fiberOf(node);
  let top: Fiber | undefined;
  for (const fiber of fiberAncestors(noted)) top = fiber;
  const root = isRecord(top?.stateNode) ? top.stateNode.current : undefined;
  const path = isFiber(root) ? (pathTo(root, node, limit, true) ?? pathTo(root, node, limit, false)) : undefined;
  return path ?? [...fiberAncestors(noted)];
}

/**
 * Premier ancêtre React de `node` (lui compris) dont les props passent `test`, dans l'arbre affiché
 * (`currentFiberAncestors` : props du dernier rendu).
 */
export function findPropsAbove(
  node: Node,
  test: (props: Record<string, unknown>) => boolean,
): { readonly fiber: Fiber; readonly props: Record<string, unknown> } | undefined {
  for (const fiber of currentFiberAncestors(node)) {
    const props = fiber.memoizedProps;
    if (isRecord(props) && test(props)) return { fiber, props };
  }
  return undefined;
}

/** Contexte fourni au-dessus d'un nœud : type de son fournisseur et valeur. */
export interface ProvidedContext {
  readonly type: unknown;
  readonly value: unknown;
}

/**
 * React 19 : le fournisseur a pour type le contexte lui-même (`react.context`) ; React 18 : `react.provider` (son
 * `react.context` est alors un consommateur, sans prop `value`).
 */
const PROVIDER_TYPES: readonly unknown[] = [Symbol.for('react.context'), Symbol.for('react.provider')];

/**
 * Contextes fournis le long de ces ancêtres (du plus proche au plus lointain, comme `currentFiberAncestors`), du
 * plus lointain au plus proche : de quoi les refournir à un composant rendu dans une autre racine.
 */
export function providedContexts(fibers: readonly Fiber[]): ProvidedContext[] {
  const contexts: ProvidedContext[] = [];
  for (const fiber of fibers) {
    const { type, memoizedProps: props } = fiber;
    if (isRecord(type) && PROVIDER_TYPES.includes(type.$$typeof) && isRecord(props) && 'value' in props) {
      contexts.push({ type, value: props.value });
    }
  }
  return contexts.reverse();
}

/**
 * Du fiber de `target` à la racine, en parcourant l'arbre depuis `root` ; avec `prune`, sans entrer dans le DOM
 * qui ne le contient pas.
 */
function pathTo(root: Fiber, target: Node, limit: number, prune: boolean): Fiber[] | undefined {
  const parents: Fiber[] = [];
  let fiber: Fiber | null | undefined = root;
  for (let steps = 0; fiber && steps < limit; steps++) {
    const node = fiber.stateNode;
    if (node === target) return [fiber, ...parents.reverse()];
    if (fiber.child && (!prune || !isDomNode(node) || node.contains(target))) {
      parents.push(fiber);
      fiber = fiber.child;
      continue;
    }
    while (fiber && !fiber.sibling) fiber = parents.pop();
    fiber = fiber?.sibling;
  }
  return undefined;
}
