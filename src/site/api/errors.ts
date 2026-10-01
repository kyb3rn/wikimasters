import { isRecord } from '@/core/guards';
import { net, type NetRequest } from '@/core/net';

/** Refus ou panne du site. `message` : le texte du site s'il en donne un (« Impossible de défausser »…). */
export class SiteApiError extends Error {
  constructor(
    message: string,
    /** Statut HTTP ; 0 pour une erreur réseau. */
    readonly status: number,
    /** Code d'erreur du site (`bid_too_low`, `automation_limit`…). */
    readonly code?: string,
  ) {
    super(message);
    this.name = 'SiteApiError';
  }
}

/** Requête restée sans réponse : coupure, site injoignable, requête interrompue. */
export const NETWORK_ERROR = "Le site n'a pas répondu (erreur réseau).";

/** Message d'une réponse en erreur : celui du site (`{ error }`) s'il en donne un, sinon son statut. */
export function siteErrorMessage(body: unknown, status: number): string {
  if (isRecord(body) && typeof body.error === 'string' && body.error.trim() !== '') return body.error;
  return `Erreur ${status} du site.`;
}

/** Texte d'une erreur pour l'utilisateur : celui d'une `SiteApiError` (erreur réseau comprise), en phrase. */
export function siteErrorText(error: unknown): string {
  const text = error instanceof SiteApiError ? error.message.trim() : '';
  if (text === '') return 'Erreur inattendue.';
  const sentence = text.charAt(0).toUpperCase() + text.slice(1);
  return /[.!?…]$/u.test(sentence) ? sentence : `${sentence}.`;
}

/**
 * Prévient de chaque refus du site pour les requêtes choisies (celles du site comprises) : réponse en erreur
 * (statut 400 et plus ; message du site, sinon son statut) ou pas de réponse du tout (`status` absent), que les
 * observateurs du réseau ne voient pas. Pour montrer en toast ce que le site afficherait dans un élément caché.
 */
export function watchSiteRefusal(
  match: (request: NetRequest) => boolean,
  onRefused: (message: string, status: number | undefined) => void,
  options: { signal: AbortSignal },
): void {
  const { signal } = options;
  net.track(
    match,
    () => (status) => {
      if (status === undefined && !signal.aborted) onRefused(NETWORK_ERROR, undefined);
    },
    { signal },
  );
  net.observe(
    match,
    async (exchange) => {
      if (exchange.status < 400) return;
      const body = await exchange.json().catch(() => undefined);
      if (!signal.aborted) onRefused(siteErrorMessage(body, exchange.status), exchange.status);
    },
    { signal },
  );
}
