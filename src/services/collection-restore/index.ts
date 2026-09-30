import type { NetRequest } from '@/core/net';
import type { CollectionQuery } from '@/site/collection';

/**
 * Requêtes de la liste et des compteurs servies par `collection-memory` avec les filtres retenus : la page
 * affiche ces filtres-là, pas ceux de l'adresse (requête par défaut à l'arrivée, puis celles des contrôles
 * remis un à un). Posé par son suivi, qui passe avant ceux des autres fonctionnalités (ordre de montage).
 */
const restored = new WeakMap<NetRequest, CollectionQuery>();

export function markRestored(request: NetRequest, query: CollectionQuery): void {
  restored.set(request, query);
}

export function restoredQuery(request: NetRequest): CollectionQuery | undefined {
  return restored.get(request);
}
