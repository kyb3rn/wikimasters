import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  defineSettings,
  featureChoice,
  onSettingsChange,
  readSettings,
  setFeatureChoice,
  SETTINGS_KEY,
} from '@/core/settings';

function fakeStorage() {
  const data = new Map<string, string>();
  return {
    data,
    getItem: (key: string) => data.get(key) ?? null,
    setItem: (key: string, value: string) => void data.set(key, value),
  };
}

let storage: ReturnType<typeof fakeStorage>;
beforeEach(() => {
  storage = fakeStorage();
  vi.stubGlobal('localStorage', storage);
});
afterEach(() => vi.unstubAllGlobals());

const schema = {
  delayMs: { type: 'number', label: 'Délai', default: 600, min: 0, max: 3000, unit: 'ms' },
  sound: { type: 'boolean', label: 'Son', default: true },
  duration: {
    type: 'choice',
    label: 'Durée',
    default: 10,
    options: [
      { value: 10, label: '10 min' },
      { value: 60, label: '1 h' },
    ],
  },
} as const;

describe('réglages', () => {
  it('donne la valeur par défaut tant que rien n’est enregistré', () => {
    const settings = defineSettings('demo', schema);
    expect(settings.get('delayMs')).toBe(600);
    expect(settings.get('sound')).toBe(true);
  });

  it('enregistre sous une seule clé, par fonctionnalité', () => {
    const settings = defineSettings('demo', schema);
    settings.set('delayMs', 1200);
    settings.set('sound', false);
    setFeatureChoice('demo', false);

    expect(JSON.parse(storage.data.get(SETTINGS_KEY) ?? '')).toEqual({
      features: { demo: false },
      values: { demo: { delayMs: 1200, sound: false } },
    });
    expect(settings.get('delayMs')).toBe(1200);
    expect(featureChoice('demo')).toBe(false);
    expect(featureChoice('autre')).toBeUndefined();
  });

  it('borne un nombre et ignore une valeur du mauvais type', () => {
    const settings = defineSettings('demo', schema);
    settings.set('delayMs', 99_999);
    expect(settings.get('delayMs')).toBe(3000);

    storage.setItem(SETTINGS_KEY, JSON.stringify({ features: { demo: 'oui' }, values: { demo: { delayMs: 'vite', sound: 1 } } }));
    expect(settings.get('delayMs')).toBe(600);
    expect(settings.get('sound')).toBe(true);
    expect(featureChoice('demo')).toBeUndefined();
  });

  it('un choix n’accepte qu’une des valeurs proposées', () => {
    const settings = defineSettings('demo', schema);
    expect(settings.get('duration')).toBe(10);
    settings.set('duration', 60);
    expect(settings.get('duration')).toBe(60);

    storage.setItem(SETTINGS_KEY, JSON.stringify({ features: {}, values: { demo: { duration: 45 } } }));
    expect(settings.get('duration')).toBe(10);
  });

  it('revient à la valeur par défaut, sans toucher aux autres réglages', () => {
    const settings = defineSettings('demo', schema);
    settings.set('delayMs', 100);
    settings.set('sound', false);
    settings.reset('delayMs');
    expect(settings.get('delayMs')).toBe(600);
    expect(readSettings().values.demo).toEqual({ sound: false });
  });

  it('tolère un stockage absent ou corrompu', () => {
    storage.setItem(SETTINGS_KEY, '{pas du json');
    expect(readSettings()).toEqual({ features: {}, values: {} });
  });

  it('prévient les abonnés de chaque changement, jusqu’à interruption', () => {
    const settings = defineSettings('demo', schema);
    const controller = new AbortController();
    let calls = 0;
    onSettingsChange(() => calls++, { signal: controller.signal });
    settings.set('delayMs', 1);
    setFeatureChoice('demo', true);
    controller.abort();
    settings.set('delayMs', 2);
    expect(calls).toBe(2);
  });

  it('refuse une clé inconnue (erreur de programmation)', () => {
    const settings = defineSettings('demo', schema);
    // @ts-expect-error clé absente du schéma
    expect(() => settings.get('inconnue')).toThrow('réglage inconnu : demo.inconnue');
  });
});
