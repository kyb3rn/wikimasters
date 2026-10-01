import type { NetExchange } from './types';

/**
 * Réponse d'intercepteur lue sans attendre : `json()` et `text()` rendent le corps en microtâches, alors que
 * celui d'une `Response` ordinaire se lit sur plusieurs tâches. Utile quand la page passe en « chargement »
 * juste avant sa requête : React n'affiche cet état qu'à son rendu suivant, dans une tâche ultérieure ; la
 * réponse arrive avant, il regroupe « chargement » et « fini », et la roue n'est jamais dessinée.
 */
export function instantResponse(body: string, init: ResponseInit): Response {
  return Object.assign(new Response(body, init), {
    json: (): Promise<unknown> => Promise.resolve().then(() => JSON.parse(body) as unknown),
    text: (): Promise<string> => Promise.resolve(body),
  });
}

/** Réponse gardée pour être resservie à une requête suivante (`replayResponse`). */
export interface CachedResponse {
  readonly body: string;
  readonly contentType: string;
}

/**
 * Garde le corps d'une réponse reçue : vue par un observateur (`NetExchange`), ou rendue par `net.fetch` (lue sur
 * une copie : l'appelant peut encore lire la sienne). À n'appeler que sur une réponse réussie : elle sera
 * resservie en 200.
 */
export async function cacheResponse(source: NetExchange | Response): Promise<CachedResponse> {
  const body = source instanceof Response ? await source.clone().text() : await source.text();
  return { body, contentType: source.headers.get('content-type') ?? 'application/json' };
}

/** Resservie par un intercepteur, sans réseau, lue sans attendre (`instantResponse`). */
export function replayResponse(cached: CachedResponse): Response {
  return instantResponse(cached.body, { status: 200, headers: { 'content-type': cached.contentType } });
}
