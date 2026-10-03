import { describe, expect, it } from 'vitest';
import { isTradeMineStats, parseTradeSummarySide, tradeCardsSide, withUntaggedFilter } from '@/site/trades';
import { netRequest } from '../../support';

describe('isTradeMineStats', () => {
  it('compteurs de « Mes cartes » : triés par rareté, en lecture', () => {
    expect(isTradeMineStats(netRequest('/api/my-collection/stats?sort=rarity'))).toBe(true);
    expect(isTradeMineStats(netRequest('/api/my-collection/stats?sort=rarity&rarity=SR&tag_id=t1&wishlisted_by=aelonka'))).toBe(true);
    expect(isTradeMineStats(netRequest('/api/my-collection/stats?sort=added'))).toBe(false);
    expect(isTradeMineStats(netRequest('/api/my-collection?sort=rarity&page=0&stats=0&owned_by=aelonka'))).toBe(false);
    expect(isTradeMineStats(netRequest('/api/my-collection/stats?sort=rarity', { method: 'POST' }))).toBe(false);
  });
});

describe('withUntaggedFilter', () => {
  const query = (path: string) => withUntaggedFilter(new URL(path, 'https://www.wiki-masters.com')).search;

  it("à la place de l'étiquette, dans l'ordre du site", () => {
    expect(query('/api/my-collection?sort=rarity&page=0&stats=0&owned_by=aelonka')).toBe('?sort=rarity&untagged=1&page=0&stats=0&owned_by=aelonka');
    expect(query('/api/my-collection?sort=rarity&q=paris&rarity=SR&rarity=R&tag_id=t1&wishlisted_by=aelonka&page=2&stats=0&owned_by=aelonka')).toBe(
      '?sort=rarity&q=paris&rarity=SR&rarity=R&untagged=1&wishlisted_by=aelonka&page=2&stats=0&owned_by=aelonka',
    );
  });

  it('compteurs : au bout, une seule fois', () => {
    expect(query('/api/my-collection/stats?sort=rarity&rarity=L')).toBe('?sort=rarity&rarity=L&untagged=1');
    expect(query('/api/my-collection/stats?sort=rarity&untagged=1')).toBe('?sort=rarity&untagged=1');
  });
});

describe('tradeCardsSide', () => {
  it('mes cartes : ma collection proposée à cet ami', () => {
    expect(tradeCardsSide(netRequest('/api/my-collection?sort=rarity&page=0&stats=0&owned_by=Latina_Wife'), 'Latina_Wife')).toBe('mine');
    expect(tradeCardsSide(netRequest('/api/my-collection?sort=rarity&page=0&stats=0&owned_by=autre'), 'Latina_Wife')).toBeUndefined();
    // Recherche d'une carte choisie d'avance, et chargement de la page Collection.
    expect(tradeCardsSide(netRequest('/api/my-collection?page=0&stats=0&q=Paris'), 'Latina_Wife')).toBeUndefined();
    expect(tradeCardsSide(netRequest('/api/my-collection/stats?sort=rarity&owned_by=Latina_Wife'), 'Latina_Wife')).toBeUndefined();
  });

  it('ses cartes : sa collection avec les échanges en cours, pseudo encodé compris', () => {
    expect(tradeCardsSide(netRequest('/api/profile/Latina_Wife/collection?page=0&sort=rarity&stats=1&pending=1'), 'Latina_Wife')).toBe('theirs');
    expect(tradeCardsSide(netRequest('/api/profile/Jean%20Pierre%20%F0%9F%90%B1/collection?page=1&pending=1'), 'Jean Pierre 🐱')).toBe('theirs');
    expect(tradeCardsSide(netRequest('/api/profile/Latina_Wife/collection?page=0&stats=0&q=Paris'), 'Latina_Wife')).toBeUndefined();
    expect(tradeCardsSide(netRequest('/api/profile/autre/collection?page=0&pending=1'), 'Latina_Wife')).toBeUndefined();
    expect(tradeCardsSide(netRequest('/api/profile/%E0%A4%A/collection?page=0&pending=1'), 'Latina_Wife')).toBeUndefined();
  });

  it('lectures seulement', () => {
    expect(tradeCardsSide(netRequest('/api/my-collection?owned_by=Latina_Wife', { method: 'POST' }), 'Latina_Wife')).toBeUndefined();
  });
});

describe('parseTradeSummarySide', () => {
  it('pseudo, cartes et wikibidous du résumé du site', () => {
    expect(parseTradeSummarySide('Moi : 0 cartes')).toEqual({ name: 'Moi', cards: 0, wikibidous: 0 });
    expect(parseTradeSummarySide('Moi : 1 carte · 70 wb')).toEqual({ name: 'Moi', cards: 1, wikibidous: 70 });
    expect(parseTradeSummarySide('Jean : Pierre : 12 cartes · 1\u202f500 wb')).toEqual({ name: 'Jean : Pierre', cards: 12, wikibidous: 1500 });
    expect(parseTradeSummarySide('autre chose')).toBeUndefined();
  });
});
