import { describe, expect, it } from 'vitest';
import {
  auctionsPath,
  cursorAfter,
  DEFAULT_FILTERS,
  parseAuctionRow,
  parseFilters,
  sameFilters,
  searchWords,
  type AuctionFilters,
  type QueryContext,
} from '@/features/market-search/query';

const NOW = Date.parse('2026-10-01T12:00:00.000Z');
const context = (change: Partial<QueryContext> = {}): QueryContext => ({
  now: NOW,
  userId: 'u0',
  wishlist: undefined,
  cursor: undefined,
  ...change,
});

/** Paramètres de la requête, décodés, dans l'ordre (un même nom peut revenir). */
function params(filters: Partial<AuctionFilters>, change: Partial<QueryContext> = {}): [string, string][] {
  const path = auctionsPath({ ...DEFAULT_FILTERS, ...filters }, context(change));
  if (!path) throw new Error('aucune requête');
  expect(path.startsWith('auctions?')).toBe(true);
  return path
    .slice('auctions?'.length)
    .split('&')
    .map((pair) => {
      const [name = '', value = ''] = pair.split('=');
      return [name, decodeURIComponent(value)];
    });
}
const values = (list: [string, string][], name: string) => list.filter(([key]) => key === name).map(([, value]) => value);

describe('requête des enchères', () => {
  it('par défaut : colonnes utiles, enchères actives encore en cours, fin la plus proche, 50, sans comptage', () => {
    const list = params({});
    expect(values(list, 'select')[0]?.split(',')).toContain('snapshot_rarity');
    expect(values(list, 'select')[0]).not.toContain('*');
    expect(values(list, 'status')).toEqual(['eq.active']);
    expect(values(list, 'end_at')).toEqual(['gt.2026-10-01T12:00:00.000Z']);
    expect(values(list, 'order')).toEqual(['end_at.asc,id.asc']);
    expect(values(list, 'limit')).toEqual(['50']);
    expect(values(list, 'and')).toEqual([]);
  });

  it('temps restant : borne basse à la place de « maintenant », borne haute en plus', () => {
    expect(values(params({ remainingMin: 30, remainingMax: 120 }), 'end_at')).toEqual([
      'gt.2026-10-01T12:30:00.000Z',
      'lte.2026-10-01T14:00:00.000Z',
    ]);
  });

  it('prix sur toutes les annonces : mise actuelle, sinon mise de départ', () => {
    expect(values(params({ priceMin: 100, priceMax: 500 }), 'and')).toEqual([
      '(or(and(current_bid.gte.100,current_bid.lte.500),and(current_bid.is.null,base_amount.gte.100,base_amount.lte.500)))',
    ]);
    expect(values(params({ priceMin: 100 }), 'and')).toEqual(['(or(current_bid.gte.100,and(current_bid.is.null,base_amount.gte.100)))']);
  });

  it('prix avec ou sans mise : une seule colonne, sans « ou »', () => {
    const withBid = params({ bids: ['with'], priceMax: 500 });
    expect(values(withBid, 'current_bid')).toEqual(['not.is.null', 'lte.500']);
    expect(values(withBid, 'and')).toEqual([]);
    const without = params({ bids: ['without'], priceMin: 10 });
    expect(values(without, 'current_bid')).toEqual(['is.null']);
    expect(values(without, 'base_amount')).toEqual(['gte.10']);
  });

  it('mises et shiny : aucune case ou les deux, pas de filtre', () => {
    for (const bids of [[], ['with', 'without']] as const) {
      const list = params({ bids, priceMin: 100 });
      expect(values(list, 'current_bid')).toEqual([]);
      expect(values(list, 'and')).toHaveLength(1);
    }
    expect(values(params({ shiny: ['shiny', 'normal'] }), 'is_shiny')).toEqual([]);
    expect(values(params({ shiny: ['shiny'] }), 'is_shiny')).toEqual(['is.true']);
  });

  it('enchères par requête : 50 à 1 000', () => {
    expect(values(params({ limit: 300 }), 'limit')).toEqual(['300']);
    expect(values(params({ limit: 5000 }), 'limit')).toEqual(['1000']);
    expect(values(params({ limit: 10 }), 'limit')).toEqual(['50']);
  });

  it('raretés, shiny, ATK, DEF, sans mes ventes', () => {
    const list = params({ rarities: ['L', 'UR'], shiny: ['normal'], atkMin: 5000, defMax: 3000, excludeMine: true });
    expect(values(list, 'snapshot_rarity')).toEqual(['in.(L,UR)']);
    expect(values(list, 'is_shiny')).toEqual(['is.false']);
    expect(values(list, 'snapshot_atk')).toEqual(['gte.5000']);
    expect(values(list, 'snapshot_def')).toEqual(['lte.3000']);
    expect(values(list, 'seller_id')).toEqual(['neq.u0']);
  });

  it('recherche : un filtre par mot, comme le document de recherche (minuscules, sans accents)', () => {
    expect(values(params({ search: '  Élysée  Paris ' }), 'snapshot_search_document')).toEqual(['ilike.*elysee*', 'ilike.*paris*']);
    expect(searchWords('a*b%c_d')).toEqual(['a', 'b', 'c', 'd']);
  });

  it('liste de souhaits : ses cartes seulement ; vide, aucune requête', () => {
    expect(values(params({ wishlistOnly: true }, { wishlist: ['c1', 'c2'] }), 'card_id')).toEqual(['in.(c1,c2)']);
    expect(auctionsPath({ ...DEFAULT_FILTERS, wishlistOnly: true }, context({ wishlist: [] }))).toBeUndefined();
  });

  it('page suivante : juste après la dernière annonce, clé brute entre guillemets, avec le prix', () => {
    const cursor = { key: '2026-10-01T12:05:00.123456+00:00', id: 'a9' };
    expect(values(params({ priceMin: 100 }, { cursor }), 'and')).toEqual([
      '(or(current_bid.gte.100,and(current_bid.is.null,base_amount.gte.100)),' +
        'or(end_at.gt."2026-10-01T12:05:00.123456+00:00",and(end_at.eq."2026-10-01T12:05:00.123456+00:00",id.gt."a9")))',
    ]);
    const recent = params({ sort: 'recent' }, { cursor });
    expect(values(recent, 'order')).toEqual(['created_at.desc,id.desc']);
    expect(values(recent, 'and')[0]).toContain('created_at.lt.');
  });

  it('le « + » du fuseau est encodé (sinon il deviendrait une espace)', () => {
    const path = auctionsPath(DEFAULT_FILTERS, context({ cursor: { key: '2026-10-01T12:05:00+00:00', id: 'a' } }));
    expect(path).toContain('%2B00%3A00');
    expect(path).not.toContain('+');
  });
});

describe('lignes', () => {
  const raw = {
    id: 'a1',
    card_id: 'c1',
    seller_id: 's1',
    end_at: '2026-10-01T12:05:00.123456+00:00',
    created_at: '2026-10-01T11:00:00+00:00',
    base_amount: 100,
    current_bid: null,
    current_bidder_id: null,
    snapshot_rarity: 'SR',
    snapshot_atk: 4000,
    snapshot_def: 3000,
    is_shiny: false,
  };

  it('lues et validées ; curseur sur la clé du tri, brute', () => {
    const row = parseAuctionRow(raw);
    expect(row).toMatchObject({ id: 'a1', rarity: 'SR', currentBid: null, shiny: false });
    expect(parseAuctionRow({ ...raw, snapshot_rarity: 'X' })).toBeUndefined();
    expect(parseAuctionRow({ ...raw, end_at: 'demain' })).toBeUndefined();
    const rows = row ? [row] : [];
    expect(cursorAfter(rows, 'ending_soon')).toEqual({ key: raw.end_at, id: 'a1' });
    expect(cursorAfter(rows, 'recent')).toEqual({ key: raw.created_at, id: 'a1' });
  });
});

describe('filtres', () => {
  it('mêmes filtres, raretés comprises', () => {
    expect(sameFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, rarities: [] })).toBe(true);
    expect(sameFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, rarities: ['L'] })).toBe(false);
    expect(sameFilters(DEFAULT_FILTERS, { ...DEFAULT_FILTERS, priceMin: 1 })).toBe(false);
  });
});

describe('filtres retenus', () => {
  it('relus tels quels, puis chaque champ illisible reprend sa valeur par défaut', () => {
    const filters = { ...DEFAULT_FILTERS, search: 'olymp', rarities: ['L'], bids: ['with'], priceMin: 100, limit: 300 } as const;
    expect(parseFilters(JSON.parse(JSON.stringify(filters)))).toEqual(filters);
    expect(parseFilters({ rarities: ['X', 'UR', 'L'], shiny: 'oui', priceMin: -3, atkMax: 'beaucoup', sort: 'prix', limit: 99_999 })).toEqual({
      ...DEFAULT_FILTERS,
      rarities: ['L', 'UR'],
      limit: 1000,
    });
    expect(parseFilters('rien')).toBeUndefined();
  });
});
