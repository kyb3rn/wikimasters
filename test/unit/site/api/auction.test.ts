import { describe, expect, it } from 'vitest';
import type { NetRequest } from '@/core/net';
import { parseAuctionCard, readAuctionRequest } from '@/site/api';

const ID = '198816ca-4758-42ca-a1d3-800a37b0d850';

const request = (url: string, method = 'GET'): NetRequest => ({
  url: new URL(url, 'https://www.wiki-masters.com'),
  method,
  headers: new Headers(),
  body: undefined,
  own: false,
});

describe('enchère affichée', () => {
  it('reconnaît la requête de la page d’une enchère, pas les autres routes du marché', () => {
    expect(readAuctionRequest(request(`/api/marketplace/${ID}`))).toBe(ID);
    expect(readAuctionRequest(request(`/api/marketplace/${ID}`, 'DELETE'))).toBeUndefined();
    expect(readAuctionRequest(request(`/api/marketplace/${ID}/bid`, 'GET'))).toBeUndefined();
    expect(readAuctionRequest(request('/api/marketplace/mine'))).toBeUndefined();
    expect(readAuctionRequest(request('/api/marketplace?page=1'))).toBeUndefined();
  });

  it('lit la carte et la rareté de l’exemplaire mis en vente', () => {
    const body = {
      auction: {
        id: ID,
        card_id: 'c1',
        snapshot_rarity: 'UR',
        card: { id: 'c1', wikipedia_title: ' Michael Mando ', rarity: 'SR' },
      },
      bids: [],
    };
    expect(parseAuctionCard(body)).toEqual({ id: 'c1', title: 'Michael Mando', rarity: 'UR' });
    expect(parseAuctionCard({ auction: { ...body.auction, snapshot_rarity: null } })?.rarity).toBe('SR');
    expect(parseAuctionCard({ auction: { id: ID } })).toBeUndefined();
    expect(parseAuctionCard({ error: 'Introuvable' })).toBeUndefined();
  });
});
