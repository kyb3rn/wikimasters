import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renameText } from '@/core/dom';
import { asElement, FakeElement, FakeText, installFakeDocument } from '../fake-dom';

beforeEach(() => void installFakeDocument());
afterEach(() => vi.unstubAllGlobals());

describe('renameText', () => {
  it('change le nœud texte qui se lit `from`, blancs autour gardés, sans toucher à l’icône', () => {
    const button = new FakeElement('button');
    const icon = new FakeElement('svg');
    const label = new FakeText('\n  Rechercher   un joueur ');
    button.append(icon, label);
    renameText(asElement(button), 'Rechercher un joueur', 'Ajouter un ami');
    expect(label.textContent).toBe('\n  Ajouter un ami ');
    expect(button.childNodes[0]).toBe(icon);
  });

  it('idempotent : un texte déjà renommé ou différent reste tel quel', () => {
    const button = new FakeElement('button');
    const label = new FakeText('Vendre');
    button.append(label);
    renameText(asElement(button), 'Mettre aux enchères', 'Vendre');
    renameText(asElement(button), 'Vendre', 'Vendre');
    expect(label.textContent).toBe('Vendre');
  });
});
