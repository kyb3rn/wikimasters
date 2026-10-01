import { isRecord } from '@/core/guards';
import { net } from '@/core/net';
import { NETWORK_ERROR, SiteApiError, siteErrorMessage } from './errors';

/**
 * Appel d'une route `/api/…` du site, comme le fait le site (cookies de session joints),
 * par `net.fetch` : la requête est marquée comme la nôtre. Corps JSON attendu ; `parse`
 * valide la réponse. Une seule tentative : pas de relance automatique d'une action.
 * Échec : `SiteApiError`, dont `siteErrorText` donne le texte à montrer.
 */
export async function siteRequest<T>(path: string, init: RequestInit, parse: (raw: unknown) => T | undefined): Promise<T> {
  let response: Response;
  try {
    response = await net.fetch(path, { credentials: 'include', ...init });
  } catch {
    throw new SiteApiError(NETWORK_ERROR, 0);
  }
  let body: unknown;
  try {
    body = await response.json();
  } catch {
    body = undefined;
  }
  if (!response.ok) {
    const code = isRecord(body) && typeof body.code === 'string' ? body.code : undefined;
    throw new SiteApiError(siteErrorMessage(body, response.status), response.status, code);
  }
  const value = parse(body);
  if (value === undefined) throw new SiteApiError('Réponse inattendue du site.', response.status);
  return value;
}
