import { describe, expect, it } from 'vitest';
import { CATEGORIES, filtered, localCategory, parseFilter, siteCategory, unreadByCategory } from '@/features/notifications/categories';

describe('filtres de la cloche', () => {
  it('range chaque type connu ; batailles, guilde, modération et types inconnus dans « Autres »', () => {
    const types = {
      chat_message: 'messages',
      marketplace_outbid: 'bids',
      marketplace_auction_won: 'bids',
      marketplace_auction_midpoint_nudge: 'listings',
      marketplace_auction_unsold: 'listings',
      marketplace_auction_sold: 'sales',
      marketplace_wishlist_listed: 'wishlist',
      friend_request: 'friends',
      trade_offer: 'trades',
      trade_accepted: 'trades',
      trade_declined: 'trades',
      trade_countered: 'trades',
      battle_invite: 'other',
      battle_accepted: 'other',
      guild_invite: 'other',
      guild_join: 'other',
      admin_cheat_warning: 'other',
      admin_sanction: 'other',
      custom: 'other',
      jamais_vu: 'other',
    };
    expect(Object.fromEntries(Object.keys(types).map((type) => [type, siteCategory(type)]))).toEqual(types);
  });

  it('notifications du script : « Enchère publiée » dans les mises en vente, les autres dans « Autres »', () => {
    expect(localCategory('auction-published')).toBe('listings');
    expect(localCategory(undefined)).toBe('other');
  });

  it('une case par catégorie, « Autres » en dernier', () => {
    expect(CATEGORIES.map(({ value }) => value)).toEqual(['messages', 'bids', 'listings', 'sales', 'wishlist', 'friends', 'trades', 'other']);
  });

  it('rien de coché : tout ; sinon les catégories cochées', () => {
    const entries = [
      { key: 'a', category: 'messages' },
      { key: 'b', category: 'sales' },
      { key: 'c', category: 'other' },
    ] as const;
    expect(filtered(entries, new Set())).toBe(entries);
    expect(filtered(entries, new Set(['sales', 'other'] as const)).map(({ key }) => key)).toEqual(['b', 'c']);
    expect(filtered(entries, new Set(['trades'] as const))).toEqual([]);
  });

  it('compte les non lues de chaque catégorie', () => {
    const counts = unreadByCategory([
      { category: 'sales', read: false },
      { category: 'sales', read: false },
      { category: 'sales', read: true },
      { category: 'other', read: false },
      { category: 'trades', read: true },
    ]);
    expect([...counts]).toEqual([
      ['sales', 2],
      ['other', 1],
    ]);
  });

  it('filtre relu du stockage : catégories inconnues écartées', () => {
    expect(parseFilter(['sales', 'disparue', 3, 'other'])).toEqual(['sales', 'other']);
    expect(parseFilter({ sales: true })).toBeUndefined();
  });
});
