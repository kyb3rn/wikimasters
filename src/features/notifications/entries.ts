import type { LocalNotification } from '@/services/notifications';
import { notificationLabel, notificationPath, notificationText, wishlistCardOf, type SiteNotification } from '@/site/notifications';
import type { IconName } from '@/ui/icons';
import type { ToastVariant } from '@/ui/toast';
import { localCategory, siteCategory, type NotificationCategory } from './categories';

/** Une ligne de la liste : notification du site ou du script. */
export type Entry =
  | (EntryView & {
      readonly kind: 'site';
      readonly notification: SiteNotification;
    })
  | (EntryView & {
      readonly kind: 'local';
      readonly notification: LocalNotification;
    });

interface EntryView {
  /** Unique dans la liste (les deux sources ont chacune leurs id). */
  readonly key: string;
  readonly icon: IconName;
  readonly category: NotificationCategory;
  readonly label: string;
  readonly text: string;
  /** Texte long, dans son propre défilement (contrôle anti-triche). */
  readonly long: boolean;
  readonly time: number;
  readonly read: boolean;
  /** Page ouverte par un clic ; aucune pour une sanction (fenêtre du site) ou une notification du script sans lien. */
  readonly href?: string;
  /** Carte de ma liste de souhaits mise en vente : la ligne propose de l'en retirer. */
  readonly wishlistCard?: string;
}

/** Icônes du site par type (sauf la liste de souhaits : la sienne plutôt que le marteau) ; bulle de message pour les autres, comme lui. */
const SITE_ICONS: Readonly<Record<string, IconName>> = {
  friend_request: 'user',
  trade_offer: 'handshake',
  trade_accepted: 'check',
  trade_declined: 'close',
  trade_countered: 'undo',
  battle_invite: 'swords',
  battle_accepted: 'gamepad',
  admin_cheat_warning: 'eye',
  admin_sanction: 'shield-alert',
  guild_invite: 'castle',
  guild_join: 'castle',
  marketplace_outbid: 'gavel',
  marketplace_auction_won: 'trophy',
  marketplace_auction_sold: 'coins',
  marketplace_auction_unsold: 'gavel',
  marketplace_auction_midpoint_nudge: 'gavel',
  marketplace_wishlist_listed: 'bookmark',
};

/** Couleur du toast d'une notification du site : bonne nouvelle en vert, à surveiller en ambre, le reste en bleu. */
const SITE_VARIANTS: Readonly<Record<string, ToastVariant>> = {
  trade_accepted: 'success',
  battle_accepted: 'success',
  marketplace_auction_won: 'success',
  marketplace_auction_sold: 'success',
  marketplace_outbid: 'warning',
  admin_cheat_warning: 'warning',
  admin_sanction: 'warning',
};

export function siteVariant(notification: SiteNotification): ToastVariant {
  return SITE_VARIANTS[notification.type] ?? 'info';
}

export function siteEntry(notification: SiteNotification): Entry {
  const time = Date.parse(notification.created_at);
  const href = notificationPath(notification);
  const wishlistCard = wishlistCardOf(notification);
  return {
    kind: 'site',
    notification,
    key: `site:${notification.id}`,
    icon: SITE_ICONS[notification.type] ?? 'message',
    category: siteCategory(notification.type),
    label: notificationLabel(notification),
    text: notificationText(notification),
    long: notification.type === 'admin_cheat_warning',
    time: Number.isNaN(time) ? 0 : time,
    read: notification.read,
    ...(href !== undefined && { href }),
    ...(wishlistCard !== undefined && { wishlistCard }),
  };
}

export function localEntry(notification: LocalNotification): Entry {
  return {
    kind: 'local',
    notification,
    key: `local:${notification.id}`,
    icon: notification.variant,
    category: localCategory(notification.type),
    label: notification.title ?? 'WikiMasters',
    text: notification.message,
    long: false,
    time: notification.createdAt,
    read: notification.read,
    ...(notification.href !== undefined && { href: notification.href }),
  };
}

/** Les deux listes mêlées, des plus récentes aux plus anciennes. */
export function mergeEntries(site: readonly SiteNotification[], local: readonly LocalNotification[]): Entry[] {
  return [...site.map(siteEntry), ...local.map(localEntry)].sort((a, b) => b.time - a.time);
}
