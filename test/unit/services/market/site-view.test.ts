import { describe, expect, it } from 'vitest';
import {
  dateTickLabel,
  fixedDomainTicks,
  lastSales,
  preserveEnd,
  siteChart,
  siteRarities,
  siteSales,
  siteSelection,
  siteStats,
  tooltipOffset,
} from '@/services/market/site-view';
import { DAY, sale, SALES_NOW } from '../../support';

describe('vue du marché du site : raretés et ventes affichées', () => {
  it('raretés qui ont des ventes, de la plus basse à la plus haute ; inconnues ignorées', () => {
    expect(siteRarities([sale(10, 1, 'L'), sale(10, 2, 'C'), sale(10, 3, ''), sale(10, 4, 'UR'), sale(10, 5, 'C')])).toEqual([
      'C',
      'UR',
      'L',
    ]);
  });

  it('« Toutes » s’il y a plusieurs raretés, la seule sinon ; le choix précédent reste tant qu’il est possible', () => {
    expect(siteSelection([], undefined)).toBeUndefined();
    expect(siteSelection(['R'], undefined)).toBe('R');
    expect(siteSelection(['R', 'L'], undefined)).toBe('any');
    expect(siteSelection(['R', 'L'], 'L')).toBe('L');
    expect(siteSelection(['R', 'L'], 'any')).toBe('any');
    // Plus qu'une rareté : « Toutes » n'existe plus ; rareté choisie disparue : retour au choix de départ.
    expect(siteSelection(['R'], 'any')).toBe('R');
    expect(siteSelection(['R', 'SR'], 'L')).toBe('any');
    expect(siteSelection(['SR'], 'L')).toBe('SR');
  });

  it('ventes du choix de la plus ancienne à la plus récente ; les 10 dernières, la plus récente d’abord', () => {
    const sales = [sale(30, 1, 'R'), sale(10, 9, 'L'), sale(20, 5, 'R'), sale(40, 3, '')];
    expect(siteSales(sales, 'R').map((s) => s.price)).toEqual([20, 30]);
    expect(siteSales(sales, 'any').map((s) => s.price)).toEqual([10, 20, 40, 30]);
    expect(siteSales(sales, undefined)).toEqual([]);

    const many = Array.from({ length: 12 }, (_, i) => sale(i + 1, 12 - i));
    expect(lastSales(many).map((s) => s.price)).toEqual([12, 11, 10, 9, 8, 7, 6, 5, 4, 3]);
  });

  it('tuiles : nombre, dernier prix, moyenne arrondie, min, max', () => {
    expect(siteStats([sale(10, 3), sale(15, 2), sale(12, 1)])).toEqual({ count: 3, average: 12, min: 10, max: 15, latest: 12 });
    expect(siteStats([sale(10, 2), sale(11, 1)])?.average).toBe(11);
    expect(siteStats([])).toBeUndefined();
  });
});

describe('vue du marché du site : repère du graphique', () => {
  it('prix : 12 % de l’écart autour, jamais sous zéro (page relevée : 11 à 6 000 → 0 à 6 719, graduations 0, 2 000, 4 000, 6 719)', () => {
    const chart = siteChart([sale(1_200, 1), sale(11, 20), sale(6_000, 40)]);
    expect([chart?.p0, chart?.p1]).toEqual([0, 6_719]);
    expect(chart?.priceTicks).toEqual([0, 2_000, 4_000, 6_719]);

    expect(siteChart([sale(100, 2), sale(200, 1)])).toMatchObject({ p0: 88, p1: 212 });
  });

  it('dates : 6 % de la durée de part et d’autre ; ventes d’un même instant : un jour, et 15 % du prix', () => {
    const chart = siteChart([sale(10, 50), sale(20, 0)]);
    expect(chart?.t0 ?? 0).toBeCloseTo(SALES_NOW - 50 * DAY - 3 * DAY, 0);
    expect(chart?.t1 ?? 0).toBeCloseTo(SALES_NOW + 3 * DAY, 0);
    expect(chart?.spanMs).toBe(50 * DAY);

    const single = siteChart([sale(40, 1)]);
    expect([single?.t1 && single.t1 - single.t0, single?.spanMs]).toEqual([2 * DAY, 2 * DAY]);
    expect([single?.p0, single?.p1]).toEqual([34, 46]);
    expect(siteChart([sale(0, 1)])).toMatchObject({ p0: 0, p1: 1 });
    expect(siteChart([])).toBeUndefined();
  });

  it('graduations des prix de Recharts : pas rond, puis le haut de l’intervalle', () => {
    expect(fixedDomainTicks(0, 120)).toEqual([0, 30, 60, 90, 120]);
    expect(fixedDomainTicks(8, 13)).toEqual([8, 10, 13]);
    expect(fixedDomainTicks(10, 11)).toEqual([10, 11]);
    expect(fixedDomainTicks(5, 5)).toEqual([5]);
  });

  it('libellés gardés en partant de la fin, à 28 px au moins l’un de l’autre ; le dernier rentre dans l’axe', () => {
    const ticks = [100, 120, 200, 300].map((coordinate) => ({ coordinate, size: 30 }));
    expect(preserveEnd(ticks, 48, 596, 28).map((tick) => tick.at)).toEqual([120, 200, 300]);
    expect(preserveEnd([{ coordinate: 590, size: 30 }], 48, 596, 28)).toEqual([{ index: 0, at: 581 }]);
    // Libellé qui sortirait avant le début de l'axe : caché.
    expect(preserveEnd([{ coordinate: 50, size: 30 }], 48, 596, 28)).toEqual([]);
    // Prix de la page relevée, vus du bas du graphique de 200 px : tous gardés, celui du haut descendu de 2,75 px.
    const prices = [30, 79.4, 128.8, 196].map((coordinate) => ({ coordinate, size: 13.5 }));
    expect(preserveEnd(prices, 0, 200, 5).map((tick) => tick.at)).toEqual([30, 79.4, 128.8, 193.25]);
  });

  it('dates de l’axe : avec l’heure sur deux jours, jour et mois jusqu’à 120 jours, mois et année au-delà', () => {
    const time = Date.UTC(2026, 8, 29, 12);
    expect(dateTickLabel(time, DAY)).toMatch(/^29 sept\..*\d{2}:\d{2}$/);
    expect(dateTickLabel(time, 30 * DAY)).toBe('29 sept.');
    expect(dateTickLabel(time, 200 * DAY)).toBe('sept. 26');
  });

  it('info-bulle : 10 px après le point, avant lui si elle sortirait du tracé, jamais avant son début', () => {
    expect(tooltipOffset(100, 150, 48, 548)).toBe(110);
    expect(tooltipOffset(500, 150, 48, 548)).toBe(340);
    expect(tooltipOffset(100, 600, 48, 548)).toBe(48);
  });
});
