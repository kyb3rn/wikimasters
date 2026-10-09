import { sleep } from '@/core/async';
import { SALES_PER_MINUTE, type SalesRate } from '@/services/market';
import { SiteApiError } from '@/site/api';

/**
 * Historiques qu'un chargement groupé laisse libres dans la minute du site : il s'arrête à 28 sur 30, pour une
 * requête comptée dans la mauvaise minute à la bascule (heure du serveur à quelques centaines de ms près) et une
 * autre d'un appareil que le compteur ne voit pas.
 */
export const RATE_MARGIN = 2;
export const BATCH_LIMIT = SALES_PER_MINUTE - RATE_MARGIN;

/** Demandes en cours en même temps, au plus (demande de l'utilisateur, 07/10/2026). */
export const CONCURRENCY = 10;
/**
 * Écart entre deux départs de demande, tiré au hasard à chaque fois entre ces bornes (demande de l'utilisateur,
 * 07/10/2026).
 */
export const SPACING_MIN_MS = 500;
export const SPACING_MAX_MS = 1000;

/** Un écart entre `SPACING_MIN_MS` et `SPACING_MAX_MS` (`random` : de 0 inclus à 1 exclu). */
export const randomSpacing = (random: () => number = Math.random): number =>
  SPACING_MIN_MS + Math.floor(random() * (SPACING_MAX_MS - SPACING_MIN_MS + 1));

/** Échecs de suite (site en panne, réponses en erreur) au bout desquels le chargement s'arrête. */
export const MAX_FAILURES = 3;

/** Encore de la place dans la minute pour un historique ? */
export function hasRoom(rate: SalesRate): boolean {
  return !rate.blocked && rate.count < BATCH_LIMIT;
}

/** Refus du site pour trop de requêtes : rien ne passera avant la minute suivante. */
export const isRateRefusal = (error: unknown): boolean => error instanceof SiteApiError && error.code === 'automation_limit';

/** Fin d'un chargement : tout est fait, la minute est pleine, le site refuse ou échoue, la page a changé. */
export type BatchEnd = 'done' | 'limit' | 'refused' | 'failures' | 'aborted';

export interface BatchResult {
  readonly end: BatchEnd;
  readonly loaded: number;
  readonly failed: number;
  /** Cartes pas demandées. */
  readonly left: number;
  /** Dernière erreur du site (refus, échecs de suite). */
  readonly error?: unknown;
}

export interface BatchOptions<T> {
  readonly load: (item: T) => Promise<unknown>;
  /** Relu avant chaque départ : encore de la place dans la minute ? */
  readonly room: () => boolean;
  readonly signal: AbortSignal;
  /** Après chaque carte, chargée ou en échec : nombre de cartes finies. */
  readonly onProgress: (done: number) => void;
  /** Attente entre deux départs (remplacée dans les tests). */
  readonly wait?: (ms: number, signal: AbortSignal) => Promise<void>;
  /** Écart avant le départ suivant (remplacé dans les tests). */
  readonly spacing?: () => number;
}

/**
 * Demande les cartes dans l'ordre, `CONCURRENCY` en cours au plus : quand une finit, la suivante part, jamais avant un
 * écart tiré au hasard depuis la précédente (`randomSpacing`). Plus aucun départ dès que la minute n'a plus de place (une minute qui bascule
 * pendant le chargement en redonne), au premier refus pour trop de requêtes, après `MAX_FAILURES` échecs de suite ou
 * quand la page change ; celles déjà parties vont à leur terme. Résolu quand toutes sont finies.
 */
export async function loadBatch<T>(items: readonly T[], { load, room, signal, onProgress, wait = sleep, spacing = randomSpacing }: BatchOptions<T>): Promise<BatchResult> {
  const running = new Set<Promise<void>>();
  const state: { stop?: { readonly end: BatchEnd; readonly error?: unknown } } = {};
  let started = 0;
  let done = 0;
  let loaded = 0;
  let failed = 0;
  let streak = 0;

  function start(item: T): void {
    const task = load(item).then(
      () => {
        loaded++;
        streak = 0;
      },
      (error: unknown) => {
        failed++;
        streak++;
        if (isRateRefusal(error)) state.stop ??= { end: 'refused', error };
        else if (streak >= MAX_FAILURES) state.stop ??= { end: 'failures', error };
      },
    );
    const tracked = task.finally(() => {
      running.delete(tracked);
      done++;
      onProgress(done);
    });
    running.add(tracked);
  }

  for (const item of items) {
    if (started > 0) await wait(spacing(), signal);
    while (running.size >= CONCURRENCY) await Promise.race(running);
    if (state.stop) break;
    if (signal.aborted) state.stop = { end: 'aborted' };
    else if (!room()) state.stop = { end: 'limit' };
    if (state.stop) break;
    started++;
    start(item);
  }
  await Promise.all(running);
  const { end = 'done', error } = state.stop ?? {};
  return { end, loaded, failed, left: items.length - started, ...(error !== undefined && { error }) };
}
