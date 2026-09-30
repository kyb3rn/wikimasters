import { isRecord } from '@/core/guards';
import { siteRequest } from './request';

/** Réponse de `GET /api/packs/pro-daily` : le pack PRO du jour est-il disponible ? */
export interface ProDailyStatus {
  readonly eligible: boolean;
  readonly claimedToday: boolean;
  /**
   * Jour dont parle la réponse (« 2026-09-30 », jour de l'appareil), présent même quand le pack n'est pas encore
   * ouvert (relevé du 30/09/2026) : réclamé, le pack revient le lendemain de ce jour.
   */
  readonly claimDate: string | undefined;
}

/** Jour dont parle une réponse de la route (lecture, ouverture, refus 409). */
export function claimDateOf(raw: unknown): string | undefined {
  const date = isRecord(raw) ? raw.claim_date : undefined;
  return typeof date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : undefined;
}

export function parseProDaily(raw: unknown): ProDailyStatus | undefined {
  if (!isRecord(raw) || (typeof raw.eligible !== 'boolean' && typeof raw.claimed_today !== 'boolean')) return undefined;
  return { eligible: raw.eligible === true, claimedToday: raw.claimed_today === true, claimDate: claimDateOf(raw) };
}

/**
 * Même demande que la page /pulls : le jour est celui du fuseau de l'appareil, envoyé en en-tête. Lecture seule
 * (rien n'est ouvert) ; le site la fait lui-même au chargement.
 */
export function fetchProDaily(): Promise<ProDailyStatus> {
  const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return siteRequest('/api/packs/pro-daily', { headers: { 'x-wiki-calendar-tz': timeZone } }, parseProDaily);
}
