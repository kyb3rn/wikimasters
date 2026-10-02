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

/** Bornes de l'avance du serveur sur le PC (ms). */
export interface OffsetBounds {
  readonly low: number;
  readonly high: number;
}

/**
 * L'en-tête `Date` (seconde entière) est écrit entre le départ de la requête et la réception de la réponse : l'avance
 * du serveur est entre `date − réception` et `date + 1 s − départ`. Recoupées d'une réponse à l'autre, ces bornes la
 * donnent à quelques centaines de millisecondes près. Plus de recouvrement (horloge du PC changée, mise en veille) :
 * on repart de la dernière réponse.
 */
export function narrowOffset(bounds: OffsetBounds | undefined, headers: Headers, startedAt: number, receivedAt: number): OffsetBounds | undefined {
  const date = Date.parse(headers.get('date') ?? '');
  if (!Number.isFinite(date) || Number(headers.get('age') ?? 0) > 0) return bounds;
  const sample = { low: date - receivedAt, high: date + 1000 - startedAt };
  if (!bounds) return sample;
  const low = Math.max(bounds.low, sample.low);
  const high = Math.min(bounds.high, sample.high);
  return low <= high ? { low, high } : sample;
}

const isDynamic = (path: string) => path.startsWith('/api/') || path.startsWith('/rest/v1/');

let offset = 0;
let bounds: OffsetBounds | undefined;

/** Heure du serveur (l'horloge du PC peut être décalée) : celle du PC tant qu'aucune réponse ne l'a mesurée. */
export const serverNow = (): number => Date.now() + offset;

/**
 * Heure du serveur à quelques centaines de millisecondes près (`narrowOffset`), écart de moins de 2 s compris : pour ce
 * qui se joue au changement de minute (limite des historiques, 02/10 : PC en retard de 1,8 s, deux requêtes comptées
 * dans la mauvaise minute). Les décomptes affichés gardent `serverNow`.
 */
export const preciseServerNow = (): number => Date.now() + (bounds ? (bounds.low + bounds.high) / 2 : offset);

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
      const receivedAt = exchange.startedAt + exchange.duration;
      const measured = serverOffset(exchange.headers, receivedAt);
      if (measured !== undefined) offset = measured;
      bounds = narrowOffset(bounds, exchange.headers, exchange.startedAt, receivedAt);
    },
  );
}
