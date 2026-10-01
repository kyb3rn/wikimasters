import { beforeEach, describe, expect, it, vi } from 'vitest';
import { lockControl, lockReason, type LockableControl } from '@/ui/lock';

/** Contrôle du site imité : classes, `data-*`, info-bulle, désactivation. */
class FakeControl {
  disabled = false;
  title = 'Défausser';
  readonly dataset: Record<string, string | undefined> = {};
  private readonly classes = new Set<string>();
  private readonly attrs = new Map<string, string>();
  getAttribute = (name: string) => this.attrs.get(name) ?? null;
  setAttribute = (name: string, value: string) => void this.attrs.set(name, value);
  removeAttribute = (name: string) => void this.attrs.delete(name);
  readonly classList = {
    contains: (name: string) => this.classes.has(name),
    add: (...names: string[]) => names.forEach((name) => this.classes.add(name)),
    remove: (...names: string[]) => names.forEach((name) => this.classes.delete(name)),
    toggle: (name: string, on: boolean) => {
      if (on) this.classes.add(name);
      else this.classes.delete(name);
      return on;
    },
  };
}

const control = () => new FakeControl() as unknown as LockableControl & FakeControl;
const BUSY = 'wm-site-busy';

beforeEach(() => {
  vi.stubGlobal('document', { getElementById: () => null, createElement: () => ({}), head: { append: () => undefined } });
  vi.stubGlobal('window', { addEventListener: () => undefined });
});

describe('lockControl, en cours', () => {
  it('verrouillé et en cours : désactivé, roue (classe), raison en info-bulle', () => {
    const button = control();
    lockControl(button, { owner: 'a', locked: true, busy: true, reason: 'Défausse en cours…' });
    expect(button.disabled).toBe(true);
    expect(button.classList.contains(BUSY)).toBe(true);
    expect(button.dataset.wmBusy).toBe('a');
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(lockReason(button)).toBe('Défausse en cours…');
  });

  it('en cours tant qu’un propriétaire l’est ; verrouillé tant qu’il en reste un', () => {
    const button = control();
    lockControl(button, { owner: 'a', locked: true, busy: true });
    lockControl(button, { owner: 'b', locked: true, busy: true });
    lockControl(button, { owner: 'a', locked: false });
    expect(button.classList.contains(BUSY)).toBe(true);
    lockControl(button, { owner: 'b', locked: true });
    expect(button.classList.contains(BUSY)).toBe(false);
    expect(button.dataset.wmBusy).toBeUndefined();
    expect(button.getAttribute('aria-busy')).toBeNull();
    expect(button.disabled).toBe(true);
    lockControl(button, { owner: 'b', locked: false });
    expect(button.disabled).toBe(false);
    expect(button.title).toBe('Défausser');
    expect(button.classList.contains('wm-site-disabled')).toBe(false);
  });

  it('« en cours » sans verrou ne fait rien', () => {
    const button = control();
    lockControl(button, { owner: 'a', locked: false, busy: true });
    expect(button.disabled).toBe(false);
    expect(button.classList.contains(BUSY)).toBe(false);
  });

  it('un contrôle que le site avait désactivé le reste', () => {
    const button = control();
    button.disabled = true;
    lockControl(button, { owner: 'a', locked: true, busy: true });
    lockControl(button, { owner: 'a', locked: false });
    expect(button.disabled).toBe(true);
    expect(button.classList.contains(BUSY)).toBe(false);
  });
});

describe('lockControl, classe réécrite par React', () => {
  it('reconnu verrouillé à ses verrous : classe remise, et le contrôle se réactive au dernier déverrouillage', () => {
    const button = control();
    lockControl(button, { owner: 'a', locked: true, reason: 'Défausse en cours…' });
    // React réécrit l'attribut `class` : la classe du verrou est perdue, le contrôle reste désactivé.
    button.classList.remove('wm-site-disabled');
    lockControl(button, { owner: 'a', locked: true, reason: 'Défausse en cours…' });
    expect(button.classList.contains('wm-site-disabled')).toBe(true);
    expect(lockReason(button)).toBe('Défausse en cours…');
    lockControl(button, { owner: 'a', locked: false });
    expect(button.disabled).toBe(false);
    expect(button.title).toBe('Défausser');
    expect(button.dataset.wmLocks).toBeUndefined();
  });
});
