import { describe, expect, it } from 'vitest';
import { parseMySales } from '@/site/api';

/** Annonce de « Mes ventes » (`selling`, capture du 02/10/2026), raccourcie. */
function listing(id: string, extra: Record<string, unknown> = {}) {
  return {
    id,
    card_id: `card-${id}`,
    card: { id: `card-${id}`, wikipedia_title: 'Tour Eiffel ', category: 'Monument', image_url: 'https://img/x.png', hide_image: false, rarity: 'L', atk: 1, def: 2 },
    status: 'active',
    base_amount: 340,
    current_bid: null,
    effective_bid: 340,
    end_at: '2026-10-02T06:27:59.212829+00:00',
    created_at: '2026-10-02T05:27:59.212829+00:00',
    snapshot_rarity: 'UR',
    snapshot_atk: 10000,
    snapshot_def: 9000,
    is_shiny: false,
    ...extra,
  };
}

describe('mes ventes en cours (`mine=1`)', () => {
  it('annonces de `selling`, aux valeurs de l’exemplaire en vente', () => {
    expect(parseMySales({ auctions: [listing('autre')], selling: [listing('a1')] })).toEqual([
      {
        id: 'a1',
        cardId: 'card-a1',
        title: 'Tour Eiffel',
        category: 'Monument',
        image: 'https://img/x.png',
        rarity: 'UR',
        shiny: false,
        atk: 10000,
        def: 9000,
        amount: 340,
        hasBid: false,
        endAt: Date.parse('2026-10-02T06:27:59.212Z'),
        obtainedAt: Date.parse('2026-10-02T05:27:59.212Z'),
      },
    ]);
  });

  it('mise actuelle s’il y en a une, shiny d’une L seulement, image cachée', () => {
    const [sale] = parseMySales({
      selling: [listing('a', { current_bid: 500, effective_bid: 500, snapshot_rarity: 'L', is_shiny: true, card: { ...listing('a').card, hide_image: true } })],
    }) ?? [];
    expect(sale).toMatchObject({ amount: 500, hasBid: true, shiny: true, image: undefined });
  });

  it('écarte une annonce finie ou illisible ; sans liste : illisible', () => {
    expect(parseMySales({ selling: [listing('a', { status: 'settled_sold' }), { id: 'b' }, 'x'] })).toEqual([]);
    expect(parseMySales({ auctions: [] })).toBeUndefined();
  });
});
