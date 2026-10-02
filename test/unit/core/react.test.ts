import { describe, expect, it } from 'vitest';
import { callbackHooks, currentFiberAncestors, findPropsAbove, providedContexts, refHooks, stateHooks, type Fiber } from '@/core/react';

interface FakeFiber {
  name: string;
  memoizedProps: unknown;
  return: FakeFiber | null;
  child: FakeFiber | null;
  sibling: FakeFiber | null;
  stateNode: unknown;
}

function fiber(name: string, props: unknown = {}, stateNode: unknown = null): FakeFiber {
  return { name, memoizedProps: props, return: null, child: null, sibling: null, stateNode };
}

/** Relie les enfants à leur parent, dans l'ordre. */
function adopt(parent: FakeFiber, ...children: FakeFiber[]): FakeFiber {
  parent.child = children[0] ?? null;
  children.forEach((child, index) => {
    child.return = parent;
    child.sibling = children[index + 1] ?? null;
  });
  return parent;
}

/** Nœud du DOM imité : `contains` suit la liste des descendants. */
function domNode(name: string, descendants: object[] = []): object {
  return { name, nodeType: 1, contains: (other: unknown) => other === descendants.find((node) => node === other) };
}

const names = (fibers: readonly Fiber[]) => fibers.map((f) => (f as unknown as FakeFiber).name);

describe('currentFiberAncestors', () => {
  it('suit l’arbre affiché, pas la version périmée notée sur le nœud', () => {
    const target = { name: 'cible', nodeType: 1, contains: () => false };
    const wrapper = domNode('enveloppe', [target]);
    const aside = domNode('à côté');

    // Arbre affiché : racine > page (onRefresh récent) > [aside, enveloppe > cible].
    const root = fiber('racine');
    root.stateNode = { current: root };
    const current = fiber('page', { onRefresh: 'récent' });
    const asideFiber = fiber('aside', {}, aside);
    const wrapperFiber = fiber('enveloppe', {}, wrapper);
    const targetFiber = fiber('cible', {}, target);
    adopt(root, adopt(current, asideFiber, adopt(wrapperFiber, targetFiber)));

    // Version précédente, notée sur le nœud : même racine, props d'avant.
    const staleRoot = fiber('racine périmée');
    staleRoot.stateNode = root.stateNode;
    const stale = adopt(fiber('page périmée', { onRefresh: 'ancien' }), fiber('cible périmée', {}, target));
    adopt(staleRoot, stale);
    Object.assign(target, { __reactFiber$x: stale.child });

    const ancestors = currentFiberAncestors(target as unknown as Element);
    expect(names(ancestors)).toEqual(['cible', 'enveloppe', 'page', 'racine']);
    expect(ancestors[2]?.memoizedProps).toEqual({ onRefresh: 'récent' });
  });

  it('élément rendu en portail (dans body, sous un nœud qui ne le contient pas) : trouvé quand même', () => {
    const target = { name: 'cible', nodeType: 1, contains: () => false };
    const main = domNode('main');
    const root = fiber('racine');
    root.stateNode = { current: root };
    const page = fiber('page', { onSelect: 'récent' });
    const portal = fiber('portail', {}, { containerInfo: {} });
    const targetFiber = fiber('cible', {}, target);
    adopt(root, adopt(page, adopt(fiber('main', {}, main), adopt(portal, targetFiber))));

    const stale = adopt(fiber('page périmée', { onSelect: 'ancien' }), fiber('cible périmée', {}, target));
    const staleRoot = fiber('racine périmée');
    staleRoot.stateNode = root.stateNode;
    adopt(staleRoot, stale);
    Object.assign(target, { __reactFiber$x: stale.child });
    const ancestors = currentFiberAncestors(target as unknown as Element);
    expect(names(ancestors)).toEqual(['cible', 'portail', 'main', 'page', 'racine']);
    expect(ancestors[3]?.memoizedProps).toEqual({ onSelect: 'récent' });
  });

  it('sans racine lisible : les ancêtres notés sur le nœud', () => {
    const target = { nodeType: 1, contains: () => false };
    const parent = fiber('parent');
    const noted = fiber('noté', {}, target);
    adopt(parent, noted);
    Object.assign(target, { __reactFiber$x: noted });
    expect(names(currentFiberAncestors(target as unknown as Element))).toEqual(['noté', 'parent']);
  });
});

describe('findPropsAbove', () => {
  it('rend le premier ancêtre de l’arbre affiché dont les props passent le test', () => {
    const target = { name: 'cible', nodeType: 1, contains: () => false };
    const root = fiber('racine');
    root.stateNode = { current: root };
    const page = fiber('page', { onRefresh: 'récent', mode: 'liste' });
    const row = fiber('ligne', { mode: 'ligne' });
    const targetFiber = fiber('cible', 'texte', target);
    adopt(root, adopt(page, adopt(row, targetFiber)));
    Object.assign(target, { __reactFiber$x: targetFiber });

    const found = findPropsAbove(target as unknown as Node, (props) => typeof props.onRefresh === 'string');
    expect(found?.props).toEqual({ onRefresh: 'récent', mode: 'liste' });
    expect((found?.fiber as unknown as FakeFiber | undefined)?.name).toBe('page');
    expect(findPropsAbove(target as unknown as Node, (props) => props.mode === 'ligne')?.props).toEqual({ mode: 'ligne' });
    expect(findPropsAbove(target as unknown as Node, () => false)).toBeUndefined();
  });
});

/** Hooks d'un composant imités : liste chaînée ; `null` = hook sans file (effet, `useRef`, `useMemo`). */
function hookList(...hooks: ({ value: unknown; dispatch: (value: unknown) => void } | null)[]): unknown {
  let next: unknown = null;
  for (const hook of [...hooks].reverse()) {
    next = hook ? { memoizedState: hook.value, queue: { dispatch: hook.dispatch }, next } : { memoizedState: { current: 0 }, queue: null, next };
  }
  return next;
}

describe('stateHooks', () => {
  it('liste les états dans l’ordre, sans les hooks sans file ; `set` passe par leur dispatch', () => {
    const calls: unknown[] = [];
    const component = {
      memoizedProps: {},
      return: null,
      memoizedState: hookList({ value: [], dispatch: () => {} }, null, { value: 3, dispatch: (value) => calls.push(value) }),
    };
    const states = stateHooks(component);
    expect(states.map((state) => state.value)).toEqual([[], 3]);
    states[1]?.set(7);
    expect(calls).toEqual([7]);
  });

  it('composant sans hooks, élément du DOM, composant classe : aucun état', () => {
    expect(stateHooks({ memoizedProps: {}, return: null })).toEqual([]);
    expect(stateHooks({ memoizedProps: {}, return: null, memoizedState: null })).toEqual([]);
    expect(stateHooks({ memoizedProps: {}, return: null, memoizedState: { open: true } })).toEqual([]);
  });
});

describe('callbackHooks', () => {
  /** Hooks chaînés : valeur de chacun (`memoizedState`), dans l'ordre. */
  const chain = (...values: unknown[]): unknown =>
    values.reduceRight<unknown>((next, value) => ({ memoizedState: value, queue: null, next }), null);

  it('liste les rappels mémorisés dans l’ordre, sans les états, effets ni références', () => {
    const load = () => 'load';
    const send = () => 'send';
    const component = {
      memoizedProps: {},
      return: null,
      memoizedState: chain([load, []], [], { current: 0 }, { tag: 9, create: () => {}, deps: [] }, [send, null], [() => {}, 'x']),
    };
    expect(callbackHooks(component)).toEqual([load, send]);
  });

  it('composant sans hooks, élément du DOM, composant classe : aucun rappel', () => {
    expect(callbackHooks({ memoizedProps: {}, return: null })).toEqual([]);
    expect(callbackHooks({ memoizedProps: {}, return: null, memoizedState: null })).toEqual([]);
    expect(callbackHooks({ memoizedProps: {}, return: null, memoizedState: { open: true } })).toEqual([]);
  });
});

describe('refHooks', () => {
  const chain = (...values: unknown[]): unknown =>
    values.reduceRight<unknown>((next, value) => ({ memoizedState: value, queue: null, next }), null);

  it('liste les valeurs des références dans l’ordre, sans les états, effets ni rappels', () => {
    const client = { realtime: {} };
    const component = {
      memoizedProps: {},
      return: null,
      memoizedState: chain(false, { current: client }, [() => {}, []], { tag: 9, create: () => {}, deps: [] }, { current: null }),
    };
    expect(refHooks(component)).toEqual([client, null]);
  });

  it('composant sans hooks : aucune référence', () => {
    expect(refHooks({ memoizedProps: {}, return: null })).toEqual([]);
    expect(refHooks({ memoizedProps: {}, return: null, memoizedState: { current: 1 } })).toEqual([]);
  });
});

describe('providedContexts', () => {
  const context = (name: string, kind = 'react.context') => ({ $$typeof: Symbol.for(kind), name });
  const node = (type: unknown, props: unknown = {}): Fiber => ({ type, memoizedProps: props, return: null });

  it('fournisseurs du plus lointain au plus proche, avec leur valeur ; le reste ignoré', () => {
    const session = context('session');
    const images = context('images');
    const ancestors = [
      node('div', { className: 'x' }),
      node(images, { value: { hideSensitive: true }, children: null }),
      node(() => null, { value: 'pas un fournisseur' }),
      node(session, { value: 'u1' }),
    ];
    expect(providedContexts(ancestors)).toEqual([
      { type: session, value: 'u1' },
      { type: images, value: { hideSensitive: true } },
    ]);
  });

  it('React 18 : son fournisseur (react.provider), pas son consommateur (react.context sans value)', () => {
    const provider = context('session', 'react.provider');
    const consumer = context('session');
    expect(providedContexts([node(consumer, { children: () => null }), node(provider, { value: null })])).toEqual([
      { type: provider, value: null },
    ]);
  });
});
