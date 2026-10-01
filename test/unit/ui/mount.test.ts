import { describe, expect, it } from 'vitest';
import { isPlaced } from '@/ui/mount';

/** Nœuds imités : juste ce que lit `isPlaced` (parent, voisins, type). */
interface FakeNode {
  nodeType: number;
  parentNode: FakeNode | null;
  previousSibling: FakeNode | null;
  nextSibling: FakeNode | null;
  previousElementSibling: FakeNode | null;
  nextElementSibling: FakeNode | null;
}

const node = (nodeType: number): FakeNode => ({
  nodeType,
  parentNode: null,
  previousSibling: null,
  nextSibling: null,
  previousElementSibling: null,
  nextElementSibling: null,
});

/** Parent et ses enfants, voisins reliés comme dans le DOM. */
function row(...types: number[]) {
  const parent = node(1);
  const children = types.map((type) => ({ ...node(type), parentNode: parent }));
  children.forEach((child, index) => {
    child.previousSibling = children[index - 1] ?? null;
    child.nextSibling = children[index + 1] ?? null;
    child.previousElementSibling = children.slice(0, index).reverse().find((other) => other.nodeType === 1) ?? null;
    child.nextElementSibling = children.slice(index + 1).find((other) => other.nodeType === 1) ?? null;
  });
  return { parent: parent as unknown as Element, children: children as unknown as Node[] };
}

const ELEMENT = 1;
const TEXT = 3;

describe('isPlaced', () => {
  it('même parent exigé', () => {
    const { parent, children } = row(ELEMENT, ELEMENT);
    const other = row(ELEMENT).parent;
    expect(isPlaced(children[0]!, { parent })).toBe(true);
    expect(isPlaced(children[0]!, { parent: other })).toBe(false);
  });

  it('avant un élément : l’élément suivant, même avec du texte entre les deux', () => {
    const { parent, children } = row(ELEMENT, TEXT, ELEMENT, ELEMENT);
    const [ours, , target, last] = children;
    expect(isPlaced(ours!, { parent, before: target })).toBe(true);
    expect(isPlaced(ours!, { parent, before: last })).toBe(false);
  });

  it('avant un nœud texte : le nœud suivant', () => {
    const { parent, children } = row(ELEMENT, TEXT, ELEMENT, TEXT);
    expect(isPlaced(children[0]!, { parent, before: children[1] })).toBe(true);
    expect(isPlaced(children[0]!, { parent, before: children[3] })).toBe(false);
  });

  it('avant `null` : dernier élément', () => {
    const { parent, children } = row(ELEMENT, ELEMENT, TEXT);
    expect(isPlaced(children[1]!, { parent, before: null })).toBe(true);
    expect(isPlaced(children[0]!, { parent, before: null })).toBe(false);
  });

  it('après un nœud : juste derrière lui', () => {
    const { parent, children } = row(ELEMENT, TEXT, ELEMENT, TEXT);
    const [anchor, text, ours] = children;
    expect(isPlaced(ours!, { parent, after: anchor })).toBe(true);
    expect(isPlaced(ours!, { parent, after: text })).toBe(true);
    expect(isPlaced(children[3]!, { parent, after: anchor })).toBe(false);
  });
});
