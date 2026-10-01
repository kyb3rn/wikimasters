import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { classMarks } from '@/core/dom';
import { asElement, FakeElement, installFakeDocument } from '../fake-dom';

beforeEach(() => void installFakeDocument());
afterEach(() => vi.unstubAllGlobals());

const has = (element: FakeElement, name: string) => element.classList.contains(name);

describe('classMarks', () => {
  it('set : pose et retire, sans écrire quand rien ne change', () => {
    const marks = classMarks(new AbortController().signal);
    const target = new FakeElement('div');
    marks.set(asElement(target), 'wm-a', true);
    const writes = target.writes;
    marks.set(asElement(target), 'wm-a', true);
    expect(target.writes).toBe(writes);
    expect(has(target, 'wm-a')).toBe(true);
    marks.set(asElement(target), 'wm-a', false);
    expect(has(target, 'wm-a')).toBe(false);
  });

  it('only : la classe exactement sur les éléments donnés, parmi ceux marqués', () => {
    const marks = classMarks(new AbortController().signal);
    const [a, b, c] = [new FakeElement('div'), new FakeElement('div'), new FakeElement('div')];
    // Classe posée par quelqu'un d'autre : pas touchée.
    c.classList.toggle('wm-x', true);
    marks.only('wm-x', [a, b].map(asElement));
    marks.only('wm-x', [b].map(asElement));
    expect([has(a, 'wm-x'), has(b, 'wm-x'), has(c, 'wm-x')]).toEqual([false, true, true]);
  });

  it('oublie les éléments retirés de la page quand ils s’accumulent (pas de fuite sur une page qui vit longtemps)', () => {
    const doc = installFakeDocument();
    const controller = new AbortController();
    const marks = classMarks(controller.signal);
    const kept = new FakeElement('div');
    doc.body?.append(kept);
    marks.set(asElement(kept), 'wm-a', true);
    const removed = Array.from({ length: 70 }, () => new FakeElement('div'));
    for (const element of removed) marks.set(asElement(element), 'wm-a', true);
    controller.abort();
    // Les éléments hors de la page ont été oubliés au tri : leur classe n'est plus retirée (sans effet visible).
    expect(has(kept, 'wm-a')).toBe(false);
    expect(removed.filter((element) => has(element, 'wm-a')).length).toBeGreaterThan(0);
  });

  it('à l’interruption : retire ses classes de ses seuls éléments, puis ne fait plus rien', () => {
    const controller = new AbortController();
    const marks = classMarks(controller.signal);
    const [a, b, other] = [new FakeElement('div'), new FakeElement('div'), new FakeElement('div')];
    marks.set(asElement(a), 'wm-a', true);
    marks.only('wm-b', [asElement(b)]);
    other.classList.toggle('wm-a', true);
    controller.abort();
    expect([has(a, 'wm-a'), has(b, 'wm-b'), has(other, 'wm-a')]).toEqual([false, false, true]);
    marks.set(asElement(a), 'wm-a', true);
    expect(has(a, 'wm-a')).toBe(false);
  });
});
