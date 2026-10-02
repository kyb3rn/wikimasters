import { describe, expect, it } from 'vitest';
import { notificationLabel, notificationPath, notificationText, parseNotificationList, wishlistCardOf } from '@/site/notifications';

const notification = (type: string, data: Record<string, unknown> = {}) => ({
  id: 'n1',
  type,
  data,
  read: false,
  created_at: '2026-09-30T13:14:23.230Z',
});

describe('notifications du site', () => {
  it('lit la liste de GET /api/notifications, lignes illisibles ignorées', () => {
    const list = parseNotificationList({
      notifications: [
        { id: 'a', user_id: 'u', type: 'marketplace_wishlist_listed', data: { title: 'Carte', message: 'Opale…' }, read: true, created_at: '2026-09-30T13:14:23.230Z' },
        { id: 'b', type: 'chat_message' },
      ],
    });
    expect(list).toEqual([
      { id: 'a', type: 'marketplace_wishlist_listed', data: { title: 'Carte', message: 'Opale…' }, read: true, created_at: '2026-09-30T13:14:23.230Z' },
    ]);
    expect(parseNotificationList({})).toBeUndefined();
  });

  it('compose libellé et texte comme le site', () => {
    expect(notificationLabel(notification('marketplace_outbid'))).toBe('Surenchéri');
    expect(notificationLabel(notification('nouveau_type'))).toBe('nouveau type');
    expect(notificationText(notification('marketplace_outbid', { card_title: 'Opale' }))).toBe('Vous avez été surenchéri sur « Opale ».');
    expect(notificationText(notification('marketplace_outbid', { message: 'Texte du site', card_title: 'Opale' }))).toBe('Texte du site');
    expect(notificationText(notification('chat_message', { sender_username: 'Léa', preview: 'Salut' }))).toBe('Léa : Salut');
    expect(notificationText(notification('trade_offer'))).toBe("Quelqu'un vous propose un échange");
    expect(notificationText(notification('trade_accepted', { recipient_username: 'Léa' }))).toBe("Léa a accepté votre offre d'échange");
    expect(notificationText(notification('autre', { title: 'Titre' }))).toBe('Titre');
  });

  it('ouvre la page du site, rien pour une sanction (fenêtre du site)', () => {
    expect(notificationPath(notification('marketplace_auction_sold', { auction_id: 'a1' }))).toBe('/marketplace/a1');
    expect(notificationPath(notification('marketplace_auction_sold'))).toBe('/marketplace');
    expect(notificationPath(notification('friend_request'))).toBe('/friends');
    expect(notificationPath(notification('chat_message'))).toBe('/dms');
    expect(notificationPath(notification('battle_invite', { battle_id: 'b1' }))).toBe('/battle/b1');
    expect(notificationPath(notification('guild_invite', { guild_id: 'g1', guild_name: 'Les Érudits' }))).toBe(
      '/guild?invite=g1&name=Les%20%C3%89rudits',
    );
    expect(notificationPath(notification('custom', { duel_id: 'd1' }))).toBe('/battle/duels/d1');
    expect(notificationPath(notification('trade_offer'))).toBe('/trades');
    expect(notificationPath(notification('admin_sanction'))).toBeUndefined();
  });

  it('donne la carte de ma liste de souhaits mise en vente, rien pour les autres types', () => {
    expect(wishlistCardOf(notification('marketplace_wishlist_listed', { card_id: 'c1', auction_id: 'a1' }))).toBe('c1');
    expect(wishlistCardOf(notification('marketplace_wishlist_listed'))).toBeUndefined();
    expect(wishlistCardOf(notification('marketplace_outbid', { card_id: 'c1' }))).toBeUndefined();
  });
});
