import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Feature } from '@/core/runtime';
import { defineSettings, setFeatureChoice } from '@/core/settings';
import { settingsItems } from '@/features/memory/settings-data';
import { fakeStorage } from '../../support';

beforeEach(() => {
  vi.stubGlobal('localStorage', fakeStorage());
  vi.useFakeTimers({ now: 5000 });
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

const market = defineSettings('market', {
  cacheHours: { type: 'number', label: 'Durée du cache', default: 48, min: 1, max: 720, unit: 'h' },
  keys: { type: 'boolean', label: 'Touches R et A', default: true },
  window: {
    type: 'choice',
    label: 'Fenêtre',
    default: 30,
    options: [
      { value: 7, label: '7 jours' },
      { value: 30, label: '30 jours' },
    ],
  },
});

const feature = (id: string, extra: Partial<Feature> = {}): Feature => ({
  id,
  name: id,
  description: '',
  category: 'Général',
  routes: 'all',
  mount: () => {},
  ...extra,
});

describe('réglages en clair', () => {
  it('nom de la fonctionnalité, libellé du réglage, valeur lisible, date du changement', () => {
    const features = [
      feature('market', { name: 'Historique du marché', settings: market }),
      feature('resale', { name: 'Revente', toggleLabel: 'Afficher la page Revente' }),
    ];
    setFeatureChoice('resale', true);
    market.set('cacheHours', 72);
    market.set('keys', false);
    market.set('window', 7);
    setFeatureChoice('disparue', false);
    expect(settingsItems(features).map(({ title, details, date }) => ({ title, details, date }))).toEqual([
      { title: 'Revente : Afficher la page Revente', details: ['Allumée'], date: 5000 },
      { title: 'disparue', details: ['Éteinte'], date: 5000 },
      { title: 'Historique du marché : Durée du cache', details: ['72 h'], date: 5000 },
      { title: 'Historique du marché : Touches R et A', details: ['Non'], date: 5000 },
      { title: 'Historique du marché : Fenêtre', details: ['7 jours'], date: 5000 },
    ]);
  });
});
