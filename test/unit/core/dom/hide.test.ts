import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { setHidden, unhideAll } from '@/core/dom';
import { asElement, FakeElement, installFakeDocument, styleText, type FakeDocument } from '../fake-dom';

let doc: FakeDocument;
beforeEach(() => {
  doc = installFakeDocument();
});
afterEach(() => vi.unstubAllGlobals());

function element(): FakeElement {
  const created = new FakeElement('div');
  doc.body?.append(created);
  return created;
}

describe('setHidden', () => {
  it('masque tant qu’un propriétaire le demande', () => {
    const target = element();
    setHidden(asElement(target), 'a', true);
    setHidden(asElement(target), 'b', true);
    expect(target.getAttribute('data-wm-hidden')).toBe('a b');
    setHidden(asElement(target), 'a', false);
    expect(target.getAttribute('data-wm-hidden')).toBe('b');
    setHidden(asElement(target), 'b', false);
    expect(target.getAttribute('data-wm-hidden')).toBeNull();
  });

  it('n’écrit rien quand rien ne change', () => {
    const target = element();
    setHidden(asElement(target), 'a', false);
    setHidden(asElement(target), 'a', true);
    const writes = target.writes;
    setHidden(asElement(target), 'a', true);
    expect(target.writes).toBe(writes);
  });

  it('pose une fois la règle qui masque', () => {
    setHidden(asElement(element()), 'a', true);
    setHidden(asElement(element()), 'b', true);
    expect(styleText(doc, 'hidden')).toBe('[data-wm-hidden] { display: none !important; }');
    expect(doc.head?.childNodes).toHaveLength(1);
  });
});

describe('unhideAll', () => {
  it('rend les éléments d’un propriétaire, pas ceux des autres', () => {
    const [one, two] = [element(), element()];
    setHidden(asElement(one), 'a', true);
    setHidden(asElement(two), 'a', true);
    setHidden(asElement(two), 'b', true);
    unhideAll('a');
    expect(one.getAttribute('data-wm-hidden')).toBeNull();
    expect(two.getAttribute('data-wm-hidden')).toBe('b');
  });
});
