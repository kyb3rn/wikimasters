import { describe, expect, it } from 'vitest';
import { matchRoute } from '@/core/router';
import { AUCTION_ROUTE, auctionPath, MARKETPLACE_ROUTE, PROFILE_ROUTE } from '@/site/routes';

describe('routes du site', () => {
  it('page d’une enchère et profil d’un joueur : leurs paramètres', () => {
    expect(matchRoute(AUCTION_ROUTE, '/marketplace/abc-123')).toEqual({ id: 'abc-123' });
    expect(matchRoute(PROFILE_ROUTE, '/profile/aelonka')).toEqual({ name: 'aelonka' });
    expect(matchRoute(AUCTION_ROUTE, MARKETPLACE_ROUTE)).toBeNull();
  });

  it('auctionPath mène à la page de l’enchère', () => {
    expect(auctionPath('abc-123')).toBe('/marketplace/abc-123');
    expect(matchRoute(AUCTION_ROUTE, auctionPath('abc-123'))).toEqual({ id: 'abc-123' });
  });
});
