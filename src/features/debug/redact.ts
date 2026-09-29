import { isRecord } from '@/core/guards';

/**
 * Masquage des secrets avant enregistrement : une capture finit dans test/fixtures/,
 * elle ne doit contenir ni jeton de session, ni clé, ni adresse e-mail, ni identifiant de paiement.
 */

export const MASK = '[masqué]';

const SECRET_HEADER = /^(authorization|proxy-authorization|apikey|x-api-key|cookie|set-cookie)$/i;
/** Clés dont la valeur est masquée : jetons, mots de passe, identifiants de paiement (Stripe, Apple). */
const SECRET_KEY =
  /(^|_)(token|secret|password|apikey|api_key)$|^(authorization|cookie)$|^stripe_|_(customer|subscription|transaction)_id$/i;
const JWT = /eyJ[\w-]{8,}\.[\w-]{8,}\.[\w-]{8,}/g;
const EMAIL = /[\w.%+-]+@[A-Za-z][A-Za-z0-9-]*(\.[A-Za-z0-9-]+)*\.[A-Za-z]{2,}\b/g;

const SECRET_PARAM = /([?&](?:apikey|api_key|access_token|refresh_token|token)=)[^&#]*/gi;

/** Jetons JWT et adresses e-mail, n'importe où dans un texte (HTML, URL, corps). */
export function redactText(text: string): string {
  return text.replace(JWT, '[jwt masqué]').replace(EMAIL, '[e-mail masqué]');
}

/** Un texte contient-il un jeton ou une adresse e-mail ? (sert à écarter un binaire illisible) */
export function containsSecret(text: string): boolean {
  return text.search(JWT) >= 0 || text.search(EMAIL) >= 0;
}

/** Adresse : paramètres sensibles (`?apikey=…` du temps réel Supabase…) masqués, puis textes. */
export function redactUrl(href: string): string {
  return redactText(href.replace(SECRET_PARAM, `$1${MASK}`));
}

export function redactHeaders(headers: Headers): Record<string, string> {
  const result: Record<string, string> = {};
  headers.forEach((value, key) => {
    result[key] = SECRET_HEADER.test(key) ? MASK : redactText(value);
  });
  return result;
}

/** Corps JSON : valeurs des clés sensibles masquées, puis textes. Autre corps : textes seulement. */
export function redactBody(text: string): string {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    return redactText(text);
  }
  return JSON.stringify(redactValue(parsed));
}

export function redactValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(redactValue);
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, item]) => [
        key,
        SECRET_KEY.test(key) && item !== null && item !== '' ? MASK : redactValue(item),
      ]),
    );
  }
  if (typeof value === 'string') return redactText(value);
  return value;
}
