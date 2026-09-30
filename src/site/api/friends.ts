import type { NetRequest } from '@/core/net';
import { siteRequest } from './request';

const FRIENDSHIP = /^\/api\/friends\/[^/]+$/;

/**
 * Retire un ami ou annule une demande (id de l'amitié, pas du joueur) : même requête que « Retirer des amis »
 * du profil et « Annuler » de la page Amis. Réponse `{ success }`.
 */
export async function removeFriendship(friendshipId: string): Promise<void> {
  await siteRequest(`/api/friends/${encodeURIComponent(friendshipId)}`, { method: 'DELETE' }, () => true);
}

/** Retrait d'un ami ou annulation d'une demande : `DELETE /api/friends/<id>`. */
export function isFriendshipDelete(request: NetRequest): boolean {
  return request.method === 'DELETE' && FRIENDSHIP.test(request.url.pathname);
}

/** Relecture des amis et des demandes (`GET /api/friends`), faite par la page Amis après chaque action. */
export function isFriendsListRequest(request: NetRequest): boolean {
  return request.method === 'GET' && request.url.pathname === '/api/friends';
}
