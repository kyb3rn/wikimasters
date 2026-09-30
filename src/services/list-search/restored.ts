import type { NetRequest } from '@/core/net';

/**
 * Requêtes de liste dues au retour aux filtres retenus (`trackListMemory`) : la page affiche les filtres
 * notés, pas forcément ceux de l'adresse (réponse servie avec d'autres). La recherche retenue ne les retient
 * pas. Posé par le suivi de la mémoire, qui passe avant les autres (ordre de montage des fonctionnalités).
 */
const restored = new WeakMap<NetRequest, unknown>();

export function markRestored(request: NetRequest, query: unknown): void {
  restored.set(request, query);
}

export function restoredQuery<Q>(request: NetRequest): Q | undefined {
  return restored.get(request) as Q | undefined;
}
