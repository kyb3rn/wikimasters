import { isRecord } from '@/core/guards';
import { createListeners } from '@/core/listeners';
import { createLogger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import { jsonStore } from '@/core/storage';
import { readSalesRequest } from '@/site/api';
import { preciseServerNow } from '@/site/clock';

/**
 * Limite du site sur les ventes d'une carte (mesurée le 02/10/2026) : 30 requêtes par minute de son horloge, compteur
 * remis à zéro à chaque hh:mm:00 ; au-delà, `403 automation_limit` sans délai indiqué. Un refus ne compte pas et ne
 * prolonge rien. Les requêtes du site comme les nôtres, de tous les onglets (compteur dans le localStorage).
 */
export const SALES_PER_MINUTE = 30;

const MINUTE = 60_000;

/** Requêtes parties dans une minute du serveur, et refus reçu dans cette minute. */
export interface RateRecord {
  /** Minute du serveur (`⌊ms / 60 000⌋`). */
  readonly minute: number;
  readonly count: number;
  readonly blocked: boolean;
}

export interface SalesRate {
  /** Requêtes parties dans la minute en cours. */
  readonly count: number;
  /** Le site a déjà refusé dans cette minute. */
  readonly blocked: boolean;
  /** Heure du serveur où le compteur repart de zéro. */
  readonly resetsAt: number;
}

const EMPTY: RateRecord = { minute: 0, count: 0, blocked: false };

const parseRecord = (raw: unknown): RateRecord | undefined =>
  isRecord(raw) && typeof raw.minute === 'number' && typeof raw.count === 'number' && typeof raw.blocked === 'boolean'
    ? { minute: raw.minute, count: raw.count, blocked: raw.blocked }
    : undefined;

const minuteOf = (time: number) => Math.floor(time / MINUTE);

/** Une requête de plus, partie à `time` (heure du serveur). */
export function countRequest(record: RateRecord, time: number): RateRecord {
  const minute = minuteOf(time);
  if (minute < record.minute) return record;
  return minute === record.minute ? { ...record, count: record.count + 1 } : { minute, count: 1, blocked: false };
}

/** Refus du site pour une requête partie à `time` : la minute est pleine. */
export function markRefused(record: RateRecord, time: number): RateRecord {
  const minute = minuteOf(time);
  if (minute < record.minute) return record;
  return { minute, count: minute === record.minute ? record.count : 0, blocked: true };
}

export function rateAt(record: RateRecord, now: number): SalesRate {
  const minute = minuteOf(now);
  const resetsAt = (minute + 1) * MINUTE;
  return record.minute === minute ? { count: record.count, blocked: record.blocked, resetsAt } : { count: 0, blocked: false, resetsAt };
}

const store = jsonStore('wm-sales-rate-v1', EMPTY, parseRecord);
const changes = createListeners(createLogger('marché'));
let tracking = false;

const isSalesRequest = (request: NetRequest) => readSalesRequest(request) !== undefined;

/** État du compteur à l'heure du serveur. */
export function salesRate(): SalesRate {
  return rateAt(store.get(), preciseServerNow());
}

/** Prévenu de chaque requête de ventes et de chaque refus vus dans cet onglet. */
export function onSalesRateChange(listener: () => void, options: { signal: AbortSignal }): void {
  changes.on(listener, options);
}

/** Compte les requêtes de ventes dès leur départ, pour toute la vie du script (appelé une fois). */
export function trackSalesRate(): void {
  if (tracking) return;
  tracking = true;
  net.track(isSalesRequest, () => {
    store.update((record) => countRequest(record, preciseServerNow()));
    changes.emit();
  });
  net.observe(isSalesRequest, async (exchange) => {
    if (exchange.status !== 403) return;
    const body = await exchange.json().catch(() => undefined);
    if (!isRecord(body) || body.code !== 'automation_limit') return;
    // Minute du refus : celle de l'en-tête `Date`, écrit par le serveur qui a refusé.
    const date = Date.parse(exchange.headers.get('date') ?? '');
    const refusedAt = Number.isFinite(date) ? date : exchange.startedAt + preciseServerNow() - Date.now();
    store.update((record) => markRefused(record, refusedAt));
    changes.emit();
  });
}
