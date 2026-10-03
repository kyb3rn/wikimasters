import { isRecord } from '@/core/guards';
import type { SiteNotification } from '@/site/notifications';

/**
 * Lecture faite dans un onglet, annoncée aux autres : des ids, ou toutes celles créées avant le départ de la requête
 * (heure du serveur) ; une notification arrivée pendant son trajet a pu rester non lue sur le serveur.
 */
export type TabRead = { readonly ids: readonly string[] } | { readonly before: number };

export function parseTabRead(raw: unknown): TabRead | undefined {
  if (!isRecord(raw)) return undefined;
  if (Array.isArray(raw.ids)) {
    const { ids } = raw;
    return ids.every((id) => typeof id === 'string') ? { ids } : undefined;
  }
  return typeof raw.before === 'number' && Number.isFinite(raw.before) ? { before: raw.before } : undefined;
}

/** Ids des non lues de cet onglet que la lecture faite ailleurs a lues. */
export function readElsewhere(notifications: readonly SiteNotification[], read: TabRead): string[] {
  const concerned: (n: SiteNotification) => boolean =
    'ids' in read ? (n) => read.ids.includes(n.id) : (n) => Date.parse(n.created_at) <= read.before;
  return notifications.filter((n) => !n.read && concerned(n)).map((n) => n.id);
}
