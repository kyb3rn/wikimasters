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
