import { describe, expect, it } from 'vitest';
import { parseAuctionCard, parseListingCard, readAuctionCancel, readAuctionCreation, readAuctionRequest } from '@/site/api';
import { netRequest } from '../../support';

const ID = '198816ca-4758-42ca-a1d3-800a37b0d850';

describe('mise aux enchères et retrait', () => {
  it('lit une mise aux enchères (le champ card_id porte l’exemplaire)', () => {
    const create = netRequest('/api/marketplace', { method: 'POST', body: { card_id: 'u1', base_amount: 90, duration_minutes: 10 } });
    expect(readAuctionCreation(create)).toEqual({ userCardId: 'u1', price: 90, minutes: 10 });
    const partial = netRequest('/api/marketplace', { method: 'POST', body: { card_id: 'u1', base_amount: '90' } });
    expect(readAuctionCreation(partial)).toEqual({ userCardId: 'u1', price: undefined, minutes: undefined });
    expect(readAuctionCreation(netRequest('/api/marketplace/a1/bid', { method: 'POST', body: { amount: 5 } }))).toBeUndefined();
    expect(readAuctionCreation(netRequest('/api/marketplace?page=1'))).toBeUndefined();
    expect(readAuctionCreation(netRequest('/api/marketplace', { method: 'POST', body: 'pas du json' }))).toBeUndefined();
  });

  it('lit une annonce retirée', () => {
    expect(readAuctionCancel(netRequest('/api/marketplace/a1', { method: 'DELETE' }))).toEqual({ auctionId: 'a1' });
    expect(readAuctionCancel(netRequest('/api/marketplace/a1'))).toBeUndefined();
    expect(readAuctionCancel(netRequest('/api/marketplace/a1/bid', { method: 'DELETE' }))).toBeUndefined();
  });
});

describe('enchère affichée', () => {
  it('reconnaît la requête de la page d’une enchère, pas les autres routes du marché', () => {
    expect(readAuctionRequest(netRequest(`/api/marketplace/${ID}`))).toBe(ID);
    expect(readAuctionRequest(netRequest(`/api/marketplace/${ID}`, { method: 'DELETE' }))).toBeUndefined();
    expect(readAuctionRequest(netRequest(`/api/marketplace/${ID}/bid`))).toBeUndefined();
    expect(readAuctionRequest(netRequest('/api/marketplace/mine'))).toBeUndefined();
    expect(readAuctionRequest(netRequest('/api/marketplace?page=1'))).toBeUndefined();
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
    // L'annonce seule, telle que dans une liste du marché.
    expect(parseListingCard(body.auction)).toEqual({ id: 'c1', title: 'Michael Mando', rarity: 'UR' });
    expect(parseListingCard(undefined)).toBeUndefined();
  });
});
