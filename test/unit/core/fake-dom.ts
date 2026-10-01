import { vi } from 'vitest';

/**
 * DOM minimal pour les tests de `core/dom` dans Node : éléments (attributs, classes, enfants), nœuds texte,
 * `document` (`head`, `body`, `getElementById`, `createElement`, `querySelectorAll('[attribut]')`). Compte les
 * écritures (`writes`) pour vérifier qu'un appel sans changement n'écrit rien.
 */
export class FakeText {
  readonly nodeType = 3;
  parentNode: FakeElement | null = null;
  constructor(public textContent: string) {}
}

export class FakeElement {
  readonly nodeType = 1;
  parentNode: FakeElement | null = null;
  readonly childNodes: (FakeElement | FakeText)[] = [];
  readonly attributes = new Map<string, string>();
  textContent: string | null = null;
  writes = 0;
  readonly classList = {
    contains: (name: string) => this.classes().includes(name),
    toggle: (name: string, on: boolean) => {
      const others = this.classes().filter((other) => other !== name);
      this.setAttribute('class', (on ? [...others, name] : others).join(' '));
      return on;
    },
  };

  constructor(readonly tagName: string) {}

  get id(): string {
    return this.attributes.get('id') ?? '';
  }

  set id(value: string) {
    this.setAttribute('id', value);
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  setAttribute(name: string, value: string): void {
    this.writes++;
    this.attributes.set(name, value);
  }

  removeAttribute(name: string): void {
    this.writes++;
    this.attributes.delete(name);
  }

  append(...nodes: (FakeElement | FakeText)[]): void {
    for (const node of nodes) {
      node.parentNode = this;
      this.childNodes.push(node);
    }
  }

  /** Dans la page : sous un `<html>`. */
  get isConnected(): boolean {
    return this.parentNode ? this.parentNode.isConnected : this.tagName === 'html';
  }

  remove(): void {
    const siblings = this.parentNode?.childNodes;
    siblings?.splice(siblings.indexOf(this), 1);
    this.parentNode = null;
  }

  *descendants(): Generator<FakeElement> {
    for (const child of this.childNodes) {
      if (!(child instanceof FakeElement)) continue;
      yield child;
      yield* child.descendants();
    }
  }

  private classes(): string[] {
    return (this.getAttribute('class') ?? '').split(' ').filter((name) => name !== '');
  }
}

export interface FakeDocument {
  documentElement: FakeElement;
  head: FakeElement | null;
  body: FakeElement | null;
  createElement(tag: string): FakeElement;
  getElementById(id: string): FakeElement | null;
  querySelectorAll(selector: string): FakeElement[];
}

/** `document` imité (avec `<head>` et `<body>` par défaut), posé en global avec `Node.TEXT_NODE`. */
export function installFakeDocument(options: { head?: boolean; body?: boolean } = {}): FakeDocument {
  const documentElement = new FakeElement('html');
  const doc: FakeDocument = {
    documentElement,
    head: null,
    body: null,
    createElement: (tag) => new FakeElement(tag),
    getElementById: (id) => [...documentElement.descendants()].find((element) => element.id === id) ?? null,
    querySelectorAll(selector) {
      const attribute = /^\[([\w-]+)\]$/.exec(selector)?.[1];
      if (!attribute) throw new Error(`sélecteur non imité : ${selector}`);
      return [...documentElement.descendants()].filter((element) => element.attributes.has(attribute));
    },
  };
  if (options.head ?? true) {
    doc.head = new FakeElement('head');
    documentElement.append(doc.head);
  }
  if (options.body ?? true) {
    doc.body = new FakeElement('body');
    documentElement.append(doc.body);
  }
  vi.stubGlobal('document', doc);
  vi.stubGlobal('Node', { TEXT_NODE: 3, ELEMENT_NODE: 1 });
  return doc;
}

/** Ajoute l'élément sous `<html>` et le note dans `document` (`head` ou `body`), comme le navigateur au chargement. */
export function arrive(doc: FakeDocument, part: 'head' | 'body'): FakeElement {
  const element = new FakeElement(part);
  doc.documentElement.append(element);
  doc[part] = element;
  return element;
}

/**
 * `MutationObserver` imité, posé en global : `mutate()` appelle les observateurs branchés, comme le navigateur
 * après un changement du DOM ; `observe` lève tant que `failing` est vrai (avant `<html>`).
 */
export function installFakeObservers() {
  const instances: { callback: () => void; connected: boolean }[] = [];
  const control = { instances, failing: false, mutate: () => instances.filter((o) => o.connected).forEach((o) => o.callback()) };
  vi.stubGlobal(
    'MutationObserver',
    class {
      readonly entry: { callback: () => void; connected: boolean };
      constructor(callback: () => void) {
        this.entry = { callback, connected: false };
        instances.push(this.entry);
      }
      observe(): void {
        if (control.failing) throw new TypeError("Failed to execute 'observe' on 'MutationObserver'");
        this.entry.connected = true;
      }
      disconnect(): void {
        this.entry.connected = false;
      }
    },
  );
  return control;
}

/** Feuille de style `wm-style-<id>` posée par le script, ou `undefined`. */
export function styleText(doc: FakeDocument, id: string): string | null | undefined {
  return doc.getElementById(`wm-style-${id}`)?.textContent;
}

export const asElement = (element: FakeElement) => element as unknown as Element;
