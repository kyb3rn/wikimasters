import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { net } from '@/core/net';

/**
 * Avance de l'horloge du serveur sur celle du PC, d'après l'en-tête `Date` d'une réponse fraîche (sans `Age` :
 * une réponse sortie d'un cache porte la date de sa création). L'en-tête est à la seconde près : un écart de
 * moins de 2 s est ignoré, sans quoi le décompte sauterait ou répéterait une seconde à chaque réponse.
 */
export function serverOffset(headers: Headers, receivedAt: number): number | undefined {
  const date = Date.parse(headers.get('date') ?? '');
  if (!Number.isFinite(date) || Number(headers.get('age') ?? 0) > 0) return undefined;
  const offset = date + 500 - receivedAt;
  return Math.abs(offset) < 2000 ? 0 : offset;
}

const isDynamic = (path: string) => path.startsWith('/api/') || path.startsWith('/rest/v1/');

let offset = 0;

/** Heure du serveur (l'horloge du PC peut être décalée) : celle du PC tant qu'aucune réponse ne l'a mesurée. */
export const serverNow = (): number => Date.now() + offset;

const seconds = createListeners(createLogger('horloge'), 'abonné à la seconde');
let secondTimer: ReturnType<typeof setTimeout> | undefined;

function scheduleSecond(): void {
  // 10 ms après le changement de seconde : `serverNow()` lu par les abonnés est bien passé à la suivante.
  secondTimer = setTimeout(
    () => {
      secondTimer = undefined;
      seconds.emit();
      if (seconds.size > 0) scheduleSecond();
    },
    1000 - (serverNow() % 1000) + 10,
  );
}

/**
 * Appelle `listener` à chaque changement de seconde de l'horloge du serveur (temps restants affichés) : une seule
 * minuterie pour tous les abonnés, arrêtée quand il n'y en a plus. Désabonné à l'interruption de `signal`.
 */
export function onServerSecond(listener: () => void, options: { signal: AbortSignal }): void {
  const { signal } = options;
  if (signal.aborted) return;
  seconds.on(listener, { signal });
  signal.addEventListener(
    'abort',
    () => {
      if (seconds.size > 0 || secondTimer === undefined) return;
      clearTimeout(secondTimer);
      secondTimer = undefined;
    },
    { once: true },
  );
  if (secondTimer === undefined) scheduleSecond();
}

/** Mesure l'horloge du serveur à chaque réponse de ses routes et de Supabase, pour toute la vie du script. */
export function trackServerClock(): void {
  net.observe(
    (request) => isDynamic(request.url.pathname),
    (exchange) => {
      if (exchange.synthetic) return;
      const measured = serverOffset(exchange.headers, exchange.startedAt + exchange.duration);
      if (measured !== undefined) offset = measured;
    },
  );
}
