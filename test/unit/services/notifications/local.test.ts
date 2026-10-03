import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { addLocalNotification, localNotifications, markLocalRead, onLocalNotificationsChange } from '@/services/notifications/local';
import { fakeStorage } from '../../support';

const KEY = 'wm-notifications-v1';
let storage: ReturnType<typeof fakeStorage>;
/** `window` imité : seulement ses événements (`storage`, écrit par un autre onglet). */
const win = new EventTarget();

beforeEach(() => {
  vi.stubGlobal('window', win);
  storage = fakeStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

const add = (message: string) => addLocalNotification({ message, variant: 'success' });

describe('notifications du script', () => {
  it('ajoutée en tête, non lue, gardée dans le stockage', () => {
    add('Première');
    const added = add('Enchère publiée');
    expect(added).toMatchObject({ message: 'Enchère publiée', variant: 'success', read: false });
    expect(localNotifications().map((n) => n.message)).toEqual(['Enchère publiée', 'Première']);
    expect(JSON.parse(storage.data.get(KEY) ?? '[]')).toHaveLength(2);
  });

  it('comme la liste du site : les 50 dernières', () => {
    for (let i = 1; i <= 52; i++) add(`n${i}`);
    const kept = localNotifications();
    expect(kept).toHaveLength(50);
    expect(kept[0]?.message).toBe('n52');
    expect(kept.at(-1)?.message).toBe('n3');
    expect(new Set(kept.map((n) => n.id)).size).toBe(50);
  });

  it('lues : celles demandées, ou toutes', () => {
    const a = add('a');
    const b = add('b');
    add('c');
    markLocalRead([a.id, b.id]);
    expect(localNotifications().map((n) => `${n.message}:${n.read}`)).toEqual(['c:false', 'b:true', 'a:true']);
    markLocalRead();
    expect(localNotifications().every((n) => n.read)).toBe(true);
  });

  it('relues du stockage : les illisibles écartées, les champs facultatifs gardés', () => {
    const base = { id: 'n1', message: 'Enchère publiée', variant: 'info', createdAt: 1 };
    storage.setItem(
      KEY,
      JSON.stringify([
        { ...base, title: 'Marché', href: '/marketplace/a1', actionLabel: 'Voir l’enchère', read: true },
        { ...base, id: 'n2', read: 'oui', title: 3 },
        { ...base, id: 'n3', variant: 'error' },
        { id: 'n4', message: 'sans date', variant: 'info' },
        'texte',
      ]),
    );
    expect(localNotifications()).toEqual([
      { ...base, title: 'Marché', href: '/marketplace/a1', actionLabel: 'Voir l’enchère', read: true },
      { ...base, id: 'n2', read: false },
    ]);
    storage.setItem(KEY, '{"pas":"une liste"}');
    expect(localNotifications()).toEqual([]);
  });

  it('genre gardé s’il est connu ; « Enchère publiée » d’avant les genres reconnue à son titre', () => {
    const base = { message: 'm', variant: 'success', createdAt: 1, read: false };
    storage.setItem(
      KEY,
      JSON.stringify([
        { ...base, id: 'n1', type: 'auction-published' },
        { ...base, id: 'n2', type: 'disparu' },
        { ...base, id: 'n3', title: 'Enchère publiée' },
        { ...base, id: 'n4', title: 'Étiquettes' },
      ]),
    );
    expect(localNotifications().map((n) => [n.id, n.type])).toEqual([
      ['n1', 'auction-published'],
      ['n2', undefined],
      ['n3', 'auction-published'],
      ['n4', undefined],
    ]);
  });

  it('abonnés prévenus des changements, ici ou dans un autre onglet, jusqu’à interruption', () => {
    const controller = new AbortController();
    let changes = 0;
    onLocalNotificationsChange(() => changes++, { signal: controller.signal });
    const a = add('a');
    markLocalRead([a.id]);
    // Déjà lue : rien ne change.
    markLocalRead([a.id]);
    expect(changes).toBe(2);
    win.dispatchEvent(Object.assign(new Event('storage'), { key: KEY }));
    win.dispatchEvent(Object.assign(new Event('storage'), { key: 'wm-settings-v1' }));
    expect(changes).toBe(3);
    controller.abort();
    add('b');
    expect(changes).toBe(3);
  });
});
