import { describe, expect, it } from 'vitest';
import { carryView, chartModel, clampView, dateTicks, priceTicks } from '@/services/market/chart';
import { DAY, sale, SALES_NOW } from '../../support';

const WINDOWS = [{ n: 5, color: 'blue' }];

describe('modèle du graphique', () => {
  it('moins de deux ventes : pas de graphique', () => {
    expect(chartModel([sale(10, 1)], WINDOWS, SALES_NOW)).toBeUndefined();
  });

  it('vue de départ : les 30 derniers jours (+5 % à droite), prix des ventes visibles, 4 % de marge en bas', () => {
    const model = chartModel([sale(500, 90), sale(100, 20), sale(200, 5)], WINDOWS, SALES_NOW);
    expect(model?.initial).toEqual({ u0: SALES_NOW - 30 * DAY, u1: SALES_NOW + 1.5 * DAY, p0: 96, p1: 200 });
    expect(model?.data).toEqual({ u0: SALES_NOW - 90 * DAY, u1: SALES_NOW - 5 * DAY, p0: 100, p1: 500 });
    expect(model?.world.p0).toBe(0);
  });

  it('vue d’ensemble (touche A) : toutes les ventes, mêmes marges', () => {
    const model = chartModel([sale(500, 90), sale(100, 20), sale(200, 5)], WINDOWS, SALES_NOW);
    expect(model?.all).toEqual({ u0: SALES_NOW - 90 * DAY, u1: SALES_NOW - 5 * DAY + 0.05 * 85 * DAY, p0: 84, p1: 500 });
  });

  it('aucune vente depuis 30 jours : toute l’étendue des ventes', () => {
    const model = chartModel([sale(100, 90), sale(200, 60)], WINDOWS, SALES_NOW);
    expect(model?.initial.u0).toBe(SALES_NOW - 90 * DAY);
    expect(model?.initial.u1).toBe(SALES_NOW - 60 * DAY + 1.5 * DAY);
  });

  it('ventes à la même date : abscisse = rang', () => {
    const model = chartModel([sale(100, 3), sale(100, 3)], WINDOWS, SALES_NOW);
    expect(model?.byIndex).toBe(true);
    expect(model?.points.map((point) => point.u)).toEqual([0, 1]);
    expect(model?.data).toMatchObject({ u0: 0, u1: 1, p0: 99, p1: 101 });
  });

  it('moyenne mobile : segments pointillés de plus en plus opaques jusqu’à la fenêtre complète', () => {
    const model = chartModel(
      [1, 2, 3, 4, 5, 6, 7].map((price, index) => sale(price, 10 - index)),
      WINDOWS,
      SALES_NOW,
    );
    const line = model?.averages[0];
    expect(line?.points.map((point) => point.count)).toEqual([2, 3, 4, 5, 5, 5]);
    expect(line?.partial.map(({ from, to }) => [from, to])).toEqual([
      [0, 1],
      [1, 2],
      [2, 3],
    ]);
    expect(line?.partial.map(({ opacity }) => Math.round(opacity * 100))).toEqual([47, 68, 90]);
  });

  it('vue bornée : ni trop près, ni trop loin, toujours en contact avec les ventes', () => {
    const model = chartModel([sale(100, 20), sale(200, 10)], WINDOWS, SALES_NOW);
    if (!model) throw new Error('modèle attendu');
    const tiny = clampView(model, { u0: SALES_NOW, u1: SALES_NOW + 1, p0: 150, p1: 150.001 });
    expect(tiny.u1 - tiny.u0).toBeCloseTo((10 * DAY) / 200);
    expect(tiny.p1 - tiny.p0).toBeCloseTo(0.5);
    const far = clampView(model, { u0: SALES_NOW + 400 * DAY, u1: SALES_NOW + 410 * DAY, p0: 1000, p1: 1100 });
    expect(far.u0).toBe(model.world.u1);
    expect(far.p0).toBe(model.world.p1);
  });

  describe('vue gardée à l’actualisation', () => {
    const before = [sale(100, 20), sale(200, 10), sale(150, 4)];
    const model = (sales = before) => {
      const built = chartModel(sales, WINDOWS, SALES_NOW);
      if (!built) throw new Error('modèle attendu');
      return built;
    };
    const zoomed = { u0: SALES_NOW - 12 * DAY, u1: SALES_NOW - 3 * DAY, p0: 90, p1: 210 };

    it('aucune vente nouvelle, ou nouvelles dans la vue : même zoom, même position', () => {
      expect(carryView(model(), zoomed, model())).toEqual(zoomed);
      expect(carryView(model(), zoomed, model([...before, sale(180, 3.5)]))).toEqual(zoomed);
    });

    it('nouvelles ventes au-delà du bord droit : décalage à gauche jusqu’à la plus récente (marge de la vue de départ), même zoom', () => {
      const view = carryView(model(), zoomed, model([...before, sale(180, 2), sale(170, 1)]));
      expect(view.u1 - view.u0).toBeCloseTo(9 * DAY);
      expect(view.u1).toBeCloseTo(SALES_NOW - DAY + (0.05 / 1.05) * 9 * DAY);
      expect(view).toMatchObject({ p0: 90, p1: 210 });
    });

    it('vue sur le passé : rien ne bouge, même avec de nouvelles ventes', () => {
      const past = { ...zoomed, u0: SALES_NOW - 25 * DAY, u1: SALES_NOW - 8 * DAY };
      expect(carryView(model(), past, model([...before, sale(180, 1)]))).toEqual(past);
    });

    it('repère changé (ventes à la même date, puis datées) : vue de départ', () => {
      const next = model([sale(100, 3), sale(120, 1)]);
      expect(carryView(model([sale(100, 3), sale(100, 3)]), { u0: 0, u1: 1, p0: 90, p1: 110 }, next)).toEqual(next.initial);
    });
  });

  it('graduations : prix « jolis » (sans −0), dates réparties bornes comprises', () => {
    expect(priceTicks({ u0: 0, u1: 1, p0: -10, p1: 95 }, 5)).toEqual([0, 25, 50, 75]);
    expect(priceTicks({ u0: 0, u1: 1, p0: -30, p1: 70 }, 5)).toEqual([-20, 0, 20, 40, 60]);
    expect(priceTicks({ u0: 0, u1: 1, p0: -1, p1: 1 }, 2).some((tick) => Object.is(tick, -0))).toBe(false);
    expect(dateTicks({ u0: 0, u1: 100, p0: 0, p1: 1 }, 5)).toEqual([0, 25, 50, 75, 100]);
  });
});
