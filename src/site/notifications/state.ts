import { waitUntil } from '@/core/async';
import { toggleStyle } from '@/core/dom';
import { isRecord } from '@/core/guards';
import { currentFiberAncestors, fiberOf } from '@/core/react';
import { isOwn } from '@/site/dom';
import { parseNotification, type SiteNotification } from './model';

/**
 * Cloche du site (code et captures du 30/09/2026) : une dans le menu latéral (ordinateur, à côté du logo),
 * une dans la barre du haut (mobile, après le solde). Même composant, mêmes données : un fournisseur React
 * (`NotificationsProvider`, autour de toute la navigation) garde la liste (50 dernières, lue par
 * `GET /api/notifications` au chargement, à chaque abonnement au canal `notifications:<uid>` et à l'ouverture
 * de la liste ; complétée par ses diffusions `INSERT`) et ses actions `{ markAsRead(ids), markAllAsRead(),
 * fetchNotifications() }` (état local seulement : la requête `PATCH` est faite par la cloche). Seule la cloche
 * lit ce fournisseur.
 */
export const SITE_BELL = 'button[aria-label="Notifications"]';

export function findSiteBells(root: ParentNode = document): HTMLButtonElement[] {
  return [...root.querySelectorAll<HTMLButtonElement>(SITE_BELL)].filter((button) => !isOwn(button));
}

export interface SiteNotificationsState {
  /** Même tableau tant que le site ne change pas sa liste : se compare par identité. */
  readonly source: readonly unknown[];
  readonly notifications: readonly SiteNotification[];
  markAsRead(ids: readonly string[]): void;
  markAllAsRead(): void;
  /** Relit la liste (`GET /api/notifications`), comme à l'ouverture de sa liste. */
  fetchNotifications(): void;
}

interface Actions {
  readonly markAsRead: (ids: string[]) => void;
  readonly markAllAsRead: () => void;
  readonly fetchNotifications: () => void;
}

function isActions(value: unknown): value is Actions {
  return (
    isRecord(value) &&
    typeof value.markAsRead === 'function' &&
    typeof value.markAllAsRead === 'function' &&
    typeof value.fetchNotifications === 'function'
  );
}

const providedValue = (props: unknown): unknown => (isRecord(props) && 'value' in props ? props.value : undefined);

/**
 * État du fournisseur, lu depuis une cloche du site : la valeur des actions, puis, plus haut, celle de la liste
 * (le fournisseur de la liste enveloppe celui des actions). `undefined` si l'arbre n'a plus cette forme.
 */
export function readSiteNotifications(bell: Element): SiteNotificationsState | undefined {
  let actions: Actions | undefined;
  for (const fiber of currentFiberAncestors(bell)) {
    const value = providedValue(fiber.memoizedProps);
    if (!actions) {
      if (isActions(value)) actions = value;
      continue;
    }
    if (!Array.isArray(value)) continue;
    const notifications = value.flatMap((item) => parseNotification(item) ?? []);
    if (notifications.length !== value.length) return undefined;
    const { markAsRead, markAllAsRead, fetchNotifications } = actions;
    return {
      source: value,
      notifications,
      markAsRead: (ids) => markAsRead([...ids]),
      markAllAsRead: () => markAllAsRead(),
      fetchNotifications: () => fetchNotifications(),
    };
  }
  return undefined;
}

/** Liste ouverte par la cloche du site : portail dans `body`, une ligne (`button`, clé React = id) par notification. */
const SITE_LIST = 'body > div.card-frame.fixed';
/** Posée le temps d'un clic relayé : la liste du site ne s'affiche pas. */
const RELAY_CSS = `${SITE_LIST} { visibility: hidden !important; }`;

function findSiteRow(id: string): HTMLButtonElement | undefined {
  for (const list of document.querySelectorAll(SITE_LIST)) {
    for (const row of list.querySelectorAll<HTMLButtonElement>('button')) {
      if (fiberOf(row)?.key === id) return row;
    }
  }
  return undefined;
}

/**
 * Clic sur une notification relayé à la cloche du site (liste ouverte cachée, puis sa ligne) : pour ce qu'elle
 * seule sait faire, la fenêtre d'une sanction (texte complet, contestation). Faux si la ligne n'est pas venue.
 */
export async function openSiteNotification(bell: HTMLButtonElement, id: string, signal: AbortSignal): Promise<boolean> {
  toggleStyle('notifications-relay', RELAY_CSS, true);
  try {
    if (bell.getAttribute('aria-expanded') !== 'true') bell.click();
    if (!(await waitUntil(() => findSiteRow(id) !== undefined, { signal, timeoutMs: 2000 }))) {
      if (bell.getAttribute('aria-expanded') === 'true') bell.click();
      return false;
    }
    findSiteRow(id)?.click();
    // Une notification non lue n'est refermée qu'après la réponse de son PATCH : la liste reste cachée jusque-là.
    await waitUntil(() => bell.getAttribute('aria-expanded') !== 'true', { signal, timeoutMs: 20_000 });
    return true;
  } finally {
    toggleStyle('notifications-relay', RELAY_CSS, false);
  }
}
