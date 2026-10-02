import type { SalesRate } from '@/services/market';

/** Orange à partir de 20 historiques dans la minute, rouge à partir de 25 (demande de l'utilisateur ; le site refuse le 31e). */
export const WARN_AT = 20;
export const DANGER_AT = 25;

export type RateLevel = 'ok' | 'warn' | 'danger';

export function rateLevel(rate: SalesRate): RateLevel {
  if (rate.blocked || rate.count >= DANGER_AT) return 'danger';
  return rate.count >= WARN_AT ? 'warn' : 'ok';
}

/** Secondes avant la remise à zéro, de 1 à 60. */
export function secondsLeft(rate: SalesRate, now: number): number {
  return Math.max(1, Math.ceil((rate.resetsAt - now) / 1000));
}
