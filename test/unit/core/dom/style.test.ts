import { afterEach, describe, expect, it, vi } from 'vitest';
import { injectStyle, removeStyle, toggleStyle, writeStyle } from '@/core/dom';
import { installFakeDocument, styleText } from '../fake-dom';

afterEach(() => vi.unstubAllGlobals());

describe('feuilles de style', () => {
  it('injectStyle : une seule fois, dans <head>', () => {
    const doc = installFakeDocument();
    injectStyle('a', '.x {}');
    injectStyle('a', '.y {}');
    expect(styleText(doc, 'a')).toBe('.x {}');
    expect(doc.head?.childNodes).toHaveLength(1);
  });

  it('writeStyle : posée, puis son contenu remplacé', () => {
    const doc = installFakeDocument();
    writeStyle('a', '.x {}');
    writeStyle('a', '.y {}');
    expect(styleText(doc, 'a')).toBe('.y {}');
    expect(doc.head?.childNodes).toHaveLength(1);
  });

  it('toggleStyle et removeStyle retirent la feuille', () => {
    const doc = installFakeDocument();
    toggleStyle('a', '.x {}', true);
    expect(styleText(doc, 'a')).toBe('.x {}');
    toggleStyle('a', '.x {}', false);
    expect(styleText(doc, 'a')).toBeUndefined();
    writeStyle('b', '.y {}');
    removeStyle('b');
    removeStyle('b');
    expect(doc.head?.childNodes).toHaveLength(0);
  });

  it('sans <head> : dans <html>', () => {
    const doc = installFakeDocument({ head: false, body: false });
    injectStyle('a', '.x {}');
    expect(doc.documentElement.childNodes).toHaveLength(1);
  });
});
