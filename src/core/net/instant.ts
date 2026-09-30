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
