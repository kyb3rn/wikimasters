import { isRecord, parseJson } from '@/core/guards';
import type { NetRequest } from '@/core/net';
import { siteRequest } from './request';

/**
 * Marque des notifications comme lues (`PATCH /api/notifications` `{ ids }`), toutes sans `ids` (`{}`) : mêmes
 * requêtes que la cloche du site (clic sur une notification non lue, « Tout marquer lu »). Réponse `{ success }`.
 */
export async function markNotificationsRead(ids?: readonly string[]): Promise<void> {
  await siteRequest(
    '/api/notifications',
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ids ? { ids } : {}),
    },
    () => true,
  );
}

/** Lecture de la liste par le site (`GET /api/notifications`). */
export function isNotificationsList(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/notifications';
}

/** Notifications marquées lues (`markNotificationsRead`, ou la cloche du site). */
export function isNotificationsMarkRead(request: NetRequest): boolean {
  return request.method === 'PATCH' && request.url.pathname === '/api/notifications';
}

/** Ids marqués lus par une requête `isNotificationsMarkRead`, `'all'` pour toutes ; `undefined` si elle ne se lit pas. */
export function readNotificationsMarkRead(request: NetRequest): readonly string[] | 'all' | undefined {
  if (!isNotificationsMarkRead(request) || request.body === undefined) return undefined;
  const body = parseJson(request.body);
  if (!isRecord(body)) return undefined;
  if (body.ids === undefined) return 'all';
  const { ids } = body;
  return Array.isArray(ids) && ids.every((id) => typeof id === 'string') ? ids : undefined;
}
