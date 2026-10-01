import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CARD_SCALES, cardDisplayCss, cardDisplayFeature, cardGridClass, type CardDisplayConfig } from '@/services/card-display';
import { fakeStorage } from '../../support';

beforeEach(() => vi.stubGlobal('localStorage', fakeStorage()));
afterEach(() => vi.unstubAllGlobals());

const display = (id: string, siteGap: number, extra: Partial<CardDisplayConfig> = {}) =>
  cardDisplayFeature({ id, category: 'Démo', routes: 'all', description: 'Démo.', siteGap, ...extra });

describe('affichage des cartes', () => {
  it('aux valeurs du site, aucune règle : ses espacements selon la largeur restent les siens', () => {
    expect(cardDisplayCss('demo', 100, 26, 26)).toBe('');
  });

  it('la taille agrandit chaque case de la grille, pas un voile de chargement', () => {
    expect(cardDisplayCss('demo', 150, 26, 26)).toBe('.wm-demo > :not([aria-busy]) { zoom: 1.5; }');
    expect(cardDisplayCss('demo', 75, 26, 26)).toBe('.wm-demo > :not([aria-busy]) { zoom: 0.75; }');
    expect(cardDisplayCss('demo', 112.5, 26, 26)).toBe('.wm-demo > :not([aria-busy]) { zoom: 1.125; }');
  });

  it('l’espacement remplace celui du site dès qu’il en diffère', () => {
    expect(cardDisplayCss('demo', 100, 40, 26)).toBe('.wm-demo { gap: 40px !important; }');
    expect(cardDisplayCss('demo', 100, 0, 20)).toBe('.wm-demo { gap: 0px !important; }');
    expect(cardDisplayCss('demo', 200, 8, 26).split('\n')).toHaveLength(2);
  });

  it('huit crans de 50 à 200 %, 100 % par défaut ; espacement du site par défaut, de 0 à 64 px', () => {
    const { settings } = display('demo-card-display', 26);
    expect(CARD_SCALES).toEqual([50, 75, 87.5, 100, 112.5, 125, 150, 200]);
    expect(settings.schema.scale.options.map((option) => option.label)).toEqual([
      '50 %',
      '75 %',
      '87,5 %',
      '100 %',
      '112,5 %',
      '125 %',
      '150 %',
      '200 %',
    ]);
    expect(settings.get('scale')).toBe(100);
    expect(settings.get('gap')).toBe(26);

    settings.set('scale', 87.5);
    expect(settings.get('scale')).toBe(87.5);
    settings.set('scale', 125);
    settings.set('gap', 999);
    expect(settings.get('scale')).toBe(125);
    expect(settings.get('gap')).toBe(64);
    settings.set('gap', -5);
    expect(settings.get('gap')).toBe(0);
    // Une taille hors des crans (réglage modifié à la main) revient à 100 %.
    settings.set('scale', 110);
    expect(settings.get('scale')).toBe(100);
  });

  it('une fonctionnalité obligatoire par réglage, en section « Apparence » de son onglet ; ses grilles portent sa classe', () => {
    const feature = display('guild-card-display', 26);
    expect(feature).toMatchObject({ id: 'guild-card-display', name: 'Apparence', category: 'Démo', routes: 'all', required: true });
    expect(feature.hidden).toBeUndefined();
    expect(cardGridClass('guild-card-display')).toBe('wm-guild-card-display');
  });

  it('chaque page a ses propres réglages', () => {
    const collection = display('collection-card-display', 26);
    const market = display('marketplace-card-display', 20);
    collection.settings.set('scale', 200);
    expect(market.settings.get('scale')).toBe(100);
    expect(market.settings.get('gap')).toBe(20);
  });
});
