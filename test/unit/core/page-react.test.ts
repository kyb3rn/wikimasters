import { afterEach, describe, expect, it, vi } from 'vitest';
import { findPageReact, renderPageComponent, type PageReact } from '@/core/page-react';

const react = { createElement: vi.fn(), createContext: () => ({}), useState: () => [] };
const reactDom = { createRoot: vi.fn(), hydrateRoot: () => ({}) };

describe('findPageReact', () => {
  it('React et react-dom/client parmi les exports des modules', () => {
    const portals = { createPortal: () => null, flushSync: () => null };
    expect(findPageReact([undefined, 'texte', portals, reactDom, { default: () => null }, react])).toEqual({ react, dom: reactDom });
  });

  it('l’un des deux manque : rien', () => {
    expect(findPageReact([react])).toBeUndefined();
    expect(findPageReact([reactDom, { createRoot: () => ({}) }])).toBeUndefined();
  });
});

describe('renderPageComponent', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  /** Élément imité : `[type, props, enfant]`. */
  function fakePage() {
    const root = { render: vi.fn(), unmount: vi.fn() };
    const options: unknown[] = [];
    const page: PageReact = {
      react: { createElement: (type, props, ...children) => [type, props, ...children] },
      dom: {
        createRoot: (_container, rootOptions) => {
          options.push(rootOptions);
          return root;
        },
      },
    };
    return { page, root, options };
  }

  it('composant sous les contextes refournis (le plus lointain dehors), dans une racine sur un nœud détaché', () => {
    vi.stubGlobal('document', { createElement: () => ({}) });
    const { page, root } = fakePage();
    const component = () => null;
    renderPageComponent(page, component, { friendUsername: 'Ami' }, {
      contexts: [
        { type: 'session', value: 'u1' },
        { type: 'images', value: true },
      ],
    });
    expect(root.render).toHaveBeenCalledWith(['session', { value: 'u1' }, ['images', { value: true }, [component, { friendUsername: 'Ami' }]]]);
  });

  it('retrait à la tâche suivante, une seule fois ; erreur de rendu relayée', () => {
    vi.useFakeTimers();
    vi.stubGlobal('document', { createElement: () => ({}) });
    const { page, root, options } = fakePage();
    const onError = vi.fn();
    const handle = renderPageComponent(page, () => null, {}, { onError });

    (options[0] as { onUncaughtError: (error: unknown) => void }).onUncaughtError('boum');
    expect(onError).toHaveBeenCalledWith('boum');

    handle.unmount();
    handle.unmount();
    expect(root.unmount).not.toHaveBeenCalled();
    vi.runAllTimers();
    expect(root.unmount).toHaveBeenCalledTimes(1);
  });
});
