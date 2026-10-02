import { isRecord } from '@/core/guards';
import { auctionPath, BATTLE_ROUTE, DMS_ROUTE, FRIENDS_ROUTE, GUILD_ROUTE, MARKETPLACE_ROUTE, TRADES_ROUTE } from '@/site/routes';

/**
 * Notification du site (`GET /api/notifications`, diffusion `notifications:<uid>`) : `data` dépend du type,
 * `title` et `message` y sont presque toujours. Types et textes repris de son code (30/09/2026).
 */
export interface SiteNotification {
  readonly id: string;
  readonly type: string;
  readonly data: Readonly<Record<string, unknown>>;
  readonly read: boolean;
  readonly created_at: string;
}

export function parseNotification(raw: unknown): SiteNotification | undefined {
  if (!isRecord(raw)) return undefined;
  const { id, type, data, read, created_at: createdAt } = raw;
  if (typeof id !== 'string' || typeof type !== 'string' || typeof createdAt !== 'string') return undefined;
  return { id, type, data: isRecord(data) ? data : {}, read: read === true, created_at: createdAt };
}

/** Liste de `GET /api/notifications` (`{ notifications: [50 dernières] }`) ; les lignes illisibles sont ignorées. */
export function parseNotificationList(raw: unknown): SiteNotification[] | undefined {
  if (!isRecord(raw) || !Array.isArray(raw.notifications)) return undefined;
  return raw.notifications.flatMap((item) => parseNotification(item) ?? []);
}

/** Libellé du type, en tête de chaque ligne de sa liste. */
const LABELS: Readonly<Record<string, string>> = {
  friend_request: "Demande d'ami",
  trade_offer: "Offre d'échange",
  trade_accepted: 'Échange accepté',
  trade_declined: 'Échange refusé',
  trade_countered: 'Contre-offre reçue',
  battle_invite: 'Défi de bataille',
  battle_accepted: 'Défi accepté',
  admin_cheat_warning: 'Contrôle anti-triche',
  admin_sanction: 'Sanction',
  chat_message: 'Message',
  guild_invite: 'Invitation de guilde',
  guild_join: 'Nouveau membre',
  marketplace_outbid: 'Surenchéri',
  marketplace_auction_won: 'Enchère gagnée',
  marketplace_auction_sold: 'Carte vendue',
  marketplace_auction_unsold: 'Enchère terminée',
  marketplace_auction_midpoint_nudge: 'Enchère sans mise',
  marketplace_wishlist_listed: 'Liste de souhaits',
  custom: 'Message',
};

export function notificationLabel(notification: SiteNotification): string {
  return LABELS[notification.type] ?? notification.type.replace(/_/g, ' ');
}

const text = (value: unknown): string | undefined => (typeof value === 'string' && value !== '' ? value : undefined);

/** Texte de la ligne, comme le site le compose. */
export function notificationText(notification: SiteNotification): string {
  const d = notification.data;
  const who = (key: string) => text(d[key]) ?? "Quelqu'un";
  const card = text(d.card_title);
  switch (notification.type) {
    case 'friend_request':
      return `${who('requester_username')} veut être votre ami`;
    case 'trade_offer':
      return `${who('initiator_username')} vous propose un échange`;
    case 'trade_countered':
      return `${who('initiator_username')} a fait une contre-offre`;
    case 'trade_accepted':
      return text(d.recipient_username) ? `${who('recipient_username')} a accepté votre offre d'échange` : 'Votre échange a été accepté';
    case 'trade_declined':
      return text(d.recipient_username) ? `${who('recipient_username')} a refusé votre offre d'échange` : 'Votre échange a été refusé';
    case 'battle_invite':
      return `${who('challenger_username')} vous défie en bataille !`;
    case 'battle_accepted':
      return `${who('opponent_username')} a accepté votre défi !`;
    case 'admin_cheat_warning':
      return text(d.message) ?? "Sanction temporaire sur l'ouverture de paquets. Consulte le message complet.";
    case 'admin_sanction':
      return text(d.preview) ?? text(d.message) ?? 'Une sanction a été appliquée à ton compte. Touche pour lire.';
    case 'chat_message':
      return `${who('sender_username')} : ${text(d.preview) ?? text(d.message) ?? 'Nouveau message'}`;
    case 'guild_invite':
      return `${who('inviter_username')} vous invite à rejoindre ${text(d.guild_name) ?? 'une guilde'}`;
    case 'guild_join':
      return `${who('username')} a rejoint votre guilde`;
    case 'marketplace_outbid':
      return text(d.message) ?? (card ? `Vous avez été surenchéri sur « ${card} ».` : 'Vous avez été surenchéri sur une enchère.');
    case 'marketplace_auction_won':
      return text(d.message) ?? (card ? `Vous avez remporté « ${card} » !` : 'Vous avez remporté une enchère !');
    case 'marketplace_auction_sold':
      return text(d.message) ?? (card ? `Votre carte « ${card} » a été vendue !` : 'Votre carte a été vendue !');
    case 'marketplace_auction_unsold':
      return (
        text(d.message) ??
        (card ? `Votre enchère pour « ${card} » s'est terminée sans acheteur.` : "Votre enchère s'est terminée sans acheteur.")
      );
    case 'marketplace_auction_midpoint_nudge':
      return text(d.message) ?? "Personne n'a encore enchéri — vous pouvez baisser votre prix de départ.";
    case 'marketplace_wishlist_listed':
      return text(d.message) ?? "Une carte de votre liste de souhaits vient d'être mise en vente.";
    default:
      return text(d.message) ?? text(d.title) ?? 'Nouvelle notification';
  }
}

/** Carte (modèle) de ma liste de souhaits mise en vente, pour une notification `marketplace_wishlist_listed`. */
export function wishlistCardOf(notification: SiteNotification): string | undefined {
  return notification.type === 'marketplace_wishlist_listed' ? text(notification.data.card_id) : undefined;
}

const MARKETPLACE_TYPES = new Set([
  'marketplace_outbid',
  'marketplace_auction_won',
  'marketplace_auction_sold',
  'marketplace_auction_unsold',
  'marketplace_auction_midpoint_nudge',
  'marketplace_wishlist_listed',
]);

/**
 * Page ouverte par un clic sur la notification, comme chez le site ; `undefined` pour une sanction, que le site
 * affiche dans sa propre fenêtre (`openSiteNotification`).
 */
export function notificationPath(notification: SiteNotification): string | undefined {
  const { type, data } = notification;
  const id = (key: string) => text(data[key]);
  if (type === 'admin_sanction') return undefined;
  if (type === 'friend_request') return FRIENDS_ROUTE;
  if (type === 'admin_cheat_warning' || type === 'chat_message') return DMS_ROUTE;
  if (type === 'battle_invite' || type === 'battle_accepted') {
    const battle = id('battle_id');
    return battle ? `${BATTLE_ROUTE}/${battle}` : BATTLE_ROUTE;
  }
  if (type === 'guild_invite') {
    return `${GUILD_ROUTE}?invite=${id('guild_id') ?? ''}&name=${encodeURIComponent(id('guild_name') ?? '')}`;
  }
  if (type === 'guild_join') return GUILD_ROUTE;
  if (MARKETPLACE_TYPES.has(type)) {
    const auction = id('auction_id');
    return auction ? auctionPath(auction) : MARKETPLACE_ROUTE;
  }
  if (type === 'custom' && id('duel_id')) return `${BATTLE_ROUTE}/duels/${id('duel_id')}`;
  return TRADES_ROUTE;
}

/** Date de la ligne, au format du site (« 30 sept., 16:20 »). */
export function formatNotificationDate(date: Date): string {
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}
