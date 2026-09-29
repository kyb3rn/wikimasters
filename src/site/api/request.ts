import { isRecord } from '@/core/guards';
import { net } from '@/core/net';

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

/**
 * Appel d'une route `/api/…` du site, comme le fait le site (cookies de session joints),
 * par `net.fetch` : la requête est marquée comme la nôtre. Corps JSON attendu ; `parse`
 * valide la réponse. Une seule tentative : pas de relance automatique d'une action.
 */
export async function siteRequest<T>(path: string, init: RequestInit, parse: (raw: unknown) => T | undefined): Promise<T> {
  let response: Response;
  try {
    response = await net.fetch(path, { credentials: 'include', ...init });
  } catch {
    throw new SiteApiError('erreur réseau', 0);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    const message = isRecord(body) && typeof body.error === 'string' ? body.error : `erreur ${response.status} du site`;
    const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
    throw new SiteApiError(message, response.status, code);
  }
  const value = parse(body);
  if (value === undefined) throw new SiteApiError('réponse inattendue du site', response.status);
  return value;
}
