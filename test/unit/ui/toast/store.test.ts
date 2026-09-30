import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createToastStore } from '@/ui/toast/store';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

const store = () =>
  createToastStore({ setTimeout: (fn, ms) => setTimeout(fn, ms), clearTimeout: (h) => clearTimeout(h as number), now: () => Date.now() });

describe('file des toasts', () => {
  it('place les erreurs en haut à droite et les notifications en bas à droite, par défaut', () => {
    const toasts = store();
    toasts.show({ message: 'panne', variant: 'error' });
    toasts.show({ message: 'attention', variant: 'warning' });
    toasts.show({ message: 'fait', variant: 'success' });
    toasts.show({ message: 'info' });
    toasts.show({ message: 'ailleurs', variant: 'error', position: 'bottom-right' });
    expect(toasts.list().map((t) => [t.message, t.variant, t.position])).toEqual([
      ['panne', 'error', 'top-right'],
      ['attention', 'warning', 'top-right'],
      ['fait', 'success', 'bottom-right'],
      ['info', 'info', 'bottom-right'],
      ['ailleurs', 'error', 'bottom-right'],
    ]);
  });

  it('retire un toast après sa durée : 6 s pour une notification, 8 s pour une erreur', () => {
    const toasts = store();
    toasts.show({ message: 'info' });
    toasts.show({ message: 'fait', variant: 'success' });
    toasts.show({ message: 'panne', variant: 'error' });
    toasts.show({ message: 'attention', variant: 'warning' });
    vi.advanceTimersByTime(5999);
    expect(toasts.list()).toHaveLength(4);
    vi.advanceTimersByTime(1);
    expect(toasts.list().map((t) => t.message)).toEqual(['panne', 'attention']);
    vi.advanceTimersByTime(2000);
    expect(toasts.list()).toEqual([]);
  });

  it('garde un toast « sticky » jusqu’à sa fermeture, et sa durée propre sinon', () => {
    const toasts = store();
    const sticky = toasts.show({ message: 'reste', variant: 'error', sticky: true });
    toasts.show({ message: 'court', durationMs: 1000 });
    vi.advanceTimersByTime(60_000);
    expect(toasts.list().map((t) => t.message)).toEqual(['reste']);
    toasts.dismiss(sticky);
    expect(toasts.list()).toEqual([]);
  });

  it('donne sa durée à un toast minuté, aucune à un toast « sticky »', () => {
    const toasts = store();
    toasts.show({ message: 'info' });
    toasts.show({ message: 'panne', variant: 'error' });
    toasts.show({ message: 'court', durationMs: 1500 });
    toasts.show({ message: 'reste', sticky: true });
    expect(toasts.list().map((t) => t.durationMs)).toEqual([6000, 8000, 1500, undefined]);
  });

  it('arrête le compte à rebours pendant la pause et le reprend là où il en était', () => {
    const toasts = store();
    const id = toasts.show({ message: 'info' });
    toasts.show({ message: 'voisin' });
    vi.advanceTimersByTime(4000);
    toasts.pause(id);
    toasts.pause(id);
    vi.advanceTimersByTime(60_000);
    expect(toasts.list().map((t) => t.message)).toEqual(['info']);
    toasts.resume(id);
    toasts.resume(id);
    vi.advanceTimersByTime(1999);
    expect(toasts.list()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.list()).toEqual([]);
  });

  it('cumule plusieurs pauses, et ignore celles d’un toast « sticky » ou fermé', () => {
    const toasts = store();
    const id = toasts.show({ message: 'info' });
    for (let i = 0; i < 3; i++) {
      vi.advanceTimersByTime(1000);
      toasts.pause(id);
      vi.advanceTimersByTime(10_000);
      toasts.resume(id);
    }
    vi.advanceTimersByTime(2999);
    expect(toasts.list()).toHaveLength(1);
    vi.advanceTimersByTime(1);
    expect(toasts.list()).toEqual([]);

    const sticky = toasts.show({ message: 'reste', sticky: true });
    toasts.pause(sticky);
    toasts.resume(sticky);
    vi.advanceTimersByTime(60_000);
    expect(toasts.list().map((t) => t.message)).toEqual(['reste']);
    toasts.dismiss(sticky);
    toasts.resume(sticky);
    expect(toasts.list()).toEqual([]);
  });

  it('garde le lien d’action du toast', () => {
    const toasts = store();
    const onClick = vi.fn();
    toasts.show({ message: 'publiée', variant: 'success', action: { label: "Voir l'enchère", onClick } });
    expect(toasts.list()[0]?.action?.label).toBe("Voir l'enchère");
    toasts.list()[0]?.action?.onClick();
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('garde au plus 4 toasts par position, en retirant les plus anciens', () => {
    const toasts = store();
    for (let i = 1; i <= 6; i++) toasts.show({ message: `e${i}`, variant: 'error' });
    toasts.show({ message: 'n1' });
    expect(toasts.list().map((t) => t.message)).toEqual(['e3', 'e4', 'e5', 'e6', 'n1']);
  });

  it('ferme un toast à la demande et prévient les abonnés', () => {
    const toasts = store();
    const listener = vi.fn();
    const unsubscribe = toasts.subscribe(listener);
    const id = toasts.show({ message: 'x' });
    toasts.dismiss(id);
    toasts.dismiss(id);
    unsubscribe();
    toasts.show({ message: 'y' });
    expect(toasts.list().map((t) => t.message)).toEqual(['y']);
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
