import { describe, expect, it } from 'vitest';
import { entryValue, halfLifeFor, interestColor, interestOf, marketValue, valueDetail, type MarketValue } from '@/features/marketplace-prices/value';
import type { MarketEntry } from '@/services/market';
import type { Sale } from '@/site/api';

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const NOW = Date.UTC(2026, 9, 2, 12);

let ids = 0;
const sale = (price: number, hoursAgo: number, rarity = 'SR'): Sale => ({ id: `s${ids++}`, price, time: NOW - hoursAgo * HOUR, rarity });

/** `count` ventes réparties de `from` à `to` heures en arrière ; `price(k)` : k = 0 pour la plus récente. */
const spread = (count: number, from: number, to: number, price: (k: number) => number) =>
  Array.from({ length: count }, (_, k) => sale(price(k), from + ((to - from) * k) / Math.max(1, count - 1)));
/** Prix qui varient de ±5 % autour de `base`, sans tendance. */
const around = (base: number) => (k: number) => base * ([1, 0.95, 1.05, 0.98, 1.02][k % 5] ?? 1);

const valueOf = (sales: readonly Sale[], fetchedAt = NOW): MarketValue => {
  const value = marketValue(sales, fetchedAt, NOW);
  if (!value) throw new Error('aucune estimation');
  return value;
};

describe('poids des ventes selon leur fraîcheur', () => {
  it('demi-vie qui laisse l’équivalent de 10 ventes : environ 19 h pour 15 ventes dans la journée, 7 jours au plus, 3 h au moins', () => {
    const day = spread(15, 0.5, 23, () => 100).map((s) => NOW - s.time);
    expect(halfLifeFor(day) / HOUR).toBeCloseTo(18.6, 0);
    expect(halfLifeFor([HOUR, 30 * HOUR, 100 * HOUR])).toBe(7 * DAY);
    expect(halfLifeFor(Array.from({ length: 200 }, (_, k) => (k / 100) * HOUR))).toBe(3 * HOUR);
  });

  it('beaucoup de ventes dans la journée : elles comptent bien plus que celles des jours d’avant', () => {
    const value = valueOf([...spread(15, 0.5, 23, around(80)), ...spread(20, 72, 120, around(100))]);
    expect(value.market).toBeCloseTo(80, 0);
  });

  it('pas de ventes dans le cache après son chargement : la fraîcheur se compte depuis le chargement', () => {
    const sales = [...spread(15, 50, 73, around(80)), ...spread(20, 122, 170, around(100))];
    expect(valueOf(sales, NOW - 50 * HOUR).market).toBeCloseTo(80, 0);
  });
});

describe('haut de la fourchette', () => {
  /** 10 ventes dans les 10 dernières heures, `high` d'entre elles (une sur trois) à 200, les autres à 150. */
  const mixed = (high: number) => spread(10, 0.5, 9.5, (k) => (k % 3 === 1 && k < 3 * high ? 200 : 150));

  it('7 ventes à 150 et 3 à 200 : vendre à 200 est possible, la revente vise 200', () => {
    const value = valueOf(mixed(3));
    expect(value.market).toBe(150);
    expect(value.top).toBe(200);
    expect(value.value).toBeGreaterThan(180);
  });

  it('2 ventes à 200 sur 10 : pas assez, la revente vise 150', () => {
    expect(valueOf(mixed(2)).top).toBe(150);
  });

  it('2 ventes très différentes : pas une carte au prix de la plus haute, même si elle est la plus récente', () => {
    const value = valueOf([sale(70, 50), sale(1430, 10)]);
    expect(value.market).toBeCloseTo(1430);
    expect(value.top).toBe(70);
    expect(value.value).toBeLessThan(70);
    expect(value.unsure).toBe(true);
    expect(interestOf(value, 600, 3).color).toBeUndefined();
  });

  it('3 ventes récentes au moins : deux ventes à 900 du mois dernier ne comptent pas pour deux', () => {
    const recent = [90, 110, 95, 105, 100, 99, 101].map((price, index) => sale(price, 20 - index));
    expect(valueOf([sale(900, 40 * 24), sale(900, 30 * 24), ...recent]).top).toBe(101);
  });

  it('une vente farfelue, en haut ou en bas, parmi beaucoup ne change rien', () => {
    const plain = valueOf(spread(15, 0.5, 23, around(100))).top;
    expect(plain).toBeGreaterThan(100);
    expect(plain).toBeLessThan(106);
    expect(valueOf([...spread(15, 0.5, 23, around(100)), sale(1000, 5)]).top).toBeLessThan(106);
    expect(valueOf([...spread(15, 0.5, 23, around(100)), sale(1, 5)]).top).toBe(plain);
  });

  it('pas de tendance prolongée : des prix en baisse ne font pas viser sous la plus basse des ventes', () => {
    // De 100 il y a 23 h à 80 maintenant.
    expect(valueOf(spread(15, 0.5, 23, (k) => 80 + (20 * k) / 14)).value).toBeGreaterThan(80);
  });
});

describe('prudence', () => {
  it('beaucoup de ventes récentes et proches : peu de prudence, estimation sûre', () => {
    const value = valueOf(spread(15, 0.5, 23, around(100)));
    expect(value.caution).toBeLessThan(0.05);
    expect(value.unsure).toBe(false);
  });

  it('1 ou 2 ventes dans la semaine : prudence forte, estimation peu sûre, même si elles sont au même prix', () => {
    for (const sales of [[sale(100, 30), sale(100, 120)], [sale(100, 1)]]) {
      const value = valueOf(sales);
      expect(value.caution).toBeGreaterThan(0.1);
      expect(value.unsure).toBe(true);
    }
  });

  it('ventes chargées il y a 3 jours : le prix a pu bouger depuis, estimation peu sûre', () => {
    const sales = spread(15, 72.5, 95, around(100));
    expect(valueOf(sales, NOW - 72 * HOUR).unsure).toBe(true);
  });
});

describe('rythme des ventes et temps de revente', () => {
  it('15 ventes dans la journée au même prix : 14 par jour (une retirée par prudence), revente en moins de 2 h', () => {
    const value = valueOf(spread(15, 0.5, 23, () => 100));
    expect(value.salesPerDay).toBeCloseTo(14);
    expect(value.resale / HOUR).toBeCloseTo(24 / 14);
  });

  it('revente au haut de la fourchette : seule une part des acheteurs paie ce prix, elle prend plus longtemps', () => {
    const value = valueOf(spread(10, 0.5, 9.5, (k) => (k % 3 === 1 ? 200 : 150)));
    const flat = valueOf(spread(10, 0.5, 9.5, () => 150));
    expect(value.topShare).toBeCloseTo(0.3, 1);
    expect(value.salesPerDay).toBeCloseTo(flat.salesPerDay);
    expect(value.resale).toBeCloseTo(flat.resale / value.topShare);
  });

  it('7 ventes aujourd’hui et 2 le mois dernier : la carte se vend (le mois d’avant ne dilue pas)', () => {
    const value = valueOf([sale(100, 900), sale(100, 700), ...spread(7, 1, 20, around(100))]);
    expect(value.salesPerDay).toBeCloseTo(6);
  });

  it('revente en 10 min au mieux, 24 h au pire', () => {
    expect(valueOf(spread(300, 0.1, 23, () => 100)).resale).toBe(10 * 60_000);
    expect(valueOf([sale(100, 1)]).resale).toBe(DAY);
  });
});

describe('intérêt d’une annonce', () => {
  // A : achetée 20, en vaut 40 ; B : achetée 400, en vaut 450 ; toutes deux très vendues, à prix fixe. C : comme B, 2 ventes en 5 jours.
  const cardA = valueOf(spread(15, 0.5, 23, () => 40));
  const cardB = valueOf(spread(15, 0.5, 23, () => 450));
  const cardC = valueOf([sale(430, 30), sale(470, 120)]);

  it('gain = revente estimée − montant ; intérêt = gain − slot occupé pendant la revente', () => {
    const interest = interestOf(cardB, 400, 3);
    expect(interest.gain).toBe(cardB.value - 400);
    expect(interest.score).toBe(Math.round(interest.gain - (3 * cardB.resale) / HOUR));
  });

  it('400 → 450 qui se vend bien passe devant 20 → 40 ; peu de ventes, il passe derrière et n’est pas coloré', () => {
    const [a, b, c] = [interestOf(cardA, 20, 3), interestOf(cardB, 400, 3), interestOf(cardC, 400, 3)];
    expect(b.score).toBeGreaterThan(a.score);
    expect(a.score).toBeGreaterThan(c.score);
    expect(a.color).toBeDefined();
    expect(c.color).toBeUndefined();
  });

  it('plus une heure de slot vaut cher, plus une carte qui se revend vite passe devant', () => {
    const slow = valueOf([...spread(3, 1, 20, around(1000)), sale(1000, 100)]);
    const fast = valueOf(spread(15, 0.5, 23, around(100)));
    expect(interestOf(slow, 800, 0).score).toBeGreaterThan(interestOf(fast, 60, 0).score);
    expect(interestOf(slow, 800, 10).score).toBeLessThan(interestOf(fast, 60, 10).score);
  });

  it('couleur dès 10 : vert, bleu à 50, rose à 200, dégradé entre eux', () => {
    expect(interestColor(9)).toBeUndefined();
    expect(interestColor(-50)).toBeUndefined();
    expect(interestColor(10)).toBe('#4ee329');
    expect(interestColor(30)).toBe('#27d394');
    expect(interestColor(50)).toBe('#00c3ff');
    expect(interestColor(125)).toBe('#8062f5');
    expect(interestColor(200)).toBe('#ff00ea');
    expect(interestColor(5000)).toBe('#ff00ea');
  });
});

describe('détail affiché au survol', () => {
  it('revente estimée et ses étapes, rythme des ventes, gain et intérêt', () => {
    const value: MarketValue = {
      market: 450,
      top: 480,
      topShare: 0.31,
      caution: 0.031,
      value: 465,
      salesPerDay: 14,
      resale: 5.5 * HOUR,
      unsure: false,
    };
    expect(valueDetail(value, { gain: 65, score: 48, color: '#00c3ff' })).toBe(
      'Revente estimée : 465 (marché 450, haut de fourchette 480, prudence −3 %)\n' +
        '≈ 14 ventes par jour, dont 31 % à 480 ou plus : revente en ≈ 6 h\n' +
        'Gain estimé : +65 · intérêt : +48',
    );
  });

  it('peu sûre, ventes rares, enchère finie (sans gain)', () => {
    const value: MarketValue = { market: 100, top: 100, topShare: 1, caution: 0.14, value: 86, salesPerDay: 0, resale: DAY, unsure: true };
    expect(valueDetail(value, undefined)).toBe('Revente estimée : 86 (marché 100, prudence −14 %, peu sûre)\nVentes rares : revente en ≈ 24 h');
  });
});

describe('estimation depuis le cache', () => {
  const entry: MarketEntry = {
    cardId: 'c1',
    title: 'Carte',
    fetchedAt: NOW,
    sales: [...spread(15, 0.5, 23, around(100)), ...spread(15, 0.5, 23, around(1000)).map((s) => ({ ...s, rarity: 'UR' }))],
  };

  it('ventes de la rareté de l’exemplaire ; rareté inconnue : toutes ; aucune dans la rareté : rien', () => {
    expect(entryValue(entry, 'SR', NOW)?.market).toBeCloseTo(100, 0);
    expect(entryValue(entry, 'UR', NOW)?.market).toBeCloseTo(1000, 0);
    expect(entryValue(entry, undefined, NOW)?.salesPerDay).toBeCloseTo(29);
    expect(entryValue(entry, 'L', NOW)).toBeUndefined();
  });

  it('même résultat à chaque lecture, l’heure seule fait vieillir l’estimation', () => {
    expect(entryValue(entry, 'SR', NOW)).toEqual(entryValue(entry, 'SR', NOW));
    expect(entryValue(entry, 'SR', NOW + 2 * DAY)?.caution).toBeGreaterThan(entryValue(entry, 'SR', NOW)?.caution ?? 1);
  });
});
