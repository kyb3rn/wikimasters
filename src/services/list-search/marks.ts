import type { NetRequest } from '@/core/net';

/*
 * Marques posées sur les requêtes de liste par un suivi, lues par ceux qui passent après lui (ordre de montage des
 * fonctionnalités : mémoire des filtres, puis recherche retenue, puis délai).
 */

/**
 * Requêtes dues au retour aux filtres retenus (`trackListMemory`) : la page affiche les filtres notés, pas
 * forcément ceux de l'adresse (réponse servie avec d'autres). La recherche retenue ne les retient pas, le délai ne
 * les fait pas attendre.
 */
const restored = new WeakMap<NetRequest, unknown>();

export function markRestored(request: NetRequest, query: unknown): void {
  restored.set(request, query);
}

export function restoredQuery<Q>(request: NetRequest): Q | undefined {
  return restored.get(request) as Q | undefined;
}

/** Requêtes lancées par l'utilisateur (Entrée, notre bouton ; `trackListHold`) : le délai ne les fait pas attendre. */
const launched = new WeakSet<NetRequest>();

export function markLaunched(request: NetRequest): void {
  launched.add(request);
}

export function wasLaunched(request: NetRequest): boolean {
  return launched.has(request);
}
