import type { Capture } from './capture';
import { binaryContent, fromBase64, socketBinaryContent, type Content } from './content';
import type { RecordedExchange, RecordedSocketEvent } from './recorder';
import { redactBody, redactHeaderRecord, redactText, redactUrl } from './redact';

/** Capture relue d'un fichier : format 1 (sans temps réel) ou 2. */
export type StoredCapture = Omit<Capture, 'version' | 'sockets'> & {
  readonly version: 1 | 2;
  readonly sockets?: readonly RecordedSocketEvent[];
};

/**
 * Réapplique les règles de masquage actuelles à une capture déjà enregistrée, quand ces règles
 * s'améliorent (`npm run captures:sanitize`). Idempotent : une capture propre ressort identique.
 */
export function sanitizeCapture(capture: StoredCapture): StoredCapture {
  return {
    ...capture,
    page: { ...capture.page, url: redactUrl(capture.page.url) },
    html: redactText(capture.html),
    exchanges: capture.exchanges.map(sanitizeExchange),
    ...(capture.sockets && { sockets: capture.sockets.map(sanitizeSocketEvent) }),
  };
}

function sanitizeExchange(exchange: RecordedExchange): RecordedExchange {
  const { bodyEncoding: _encoding, ...rest } = exchange;
  const body: Content =
    exchange.bodyEncoding === 'base64'
      ? binaryContent(fromBase64(exchange.body), exchange.responseHeaders['content-type'] ?? 'binaire', Infinity)
      : { text: redactBody(exchange.body), truncated: exchange.truncated };
  return {
    ...rest,
    url: redactUrl(exchange.url),
    requestHeaders: redactHeaderRecord(exchange.requestHeaders),
    ...(exchange.requestBody !== undefined && { requestBody: redactBody(exchange.requestBody) }),
    responseHeaders: redactHeaderRecord(exchange.responseHeaders),
    body: body.text,
    ...(body.encoding === 'base64' && { bodyEncoding: 'base64' as const }),
    truncated: exchange.truncated || body.truncated,
  };
}

function sanitizeSocketEvent(event: RecordedSocketEvent): RecordedSocketEvent {
  const { data, dataEncoding, truncated, ...rest } = event;
  const base = { ...rest, url: redactUrl(event.url) };
  if (data === undefined) return base;
  const content: Content =
    dataEncoding === 'base64'
      ? socketBinaryContent(fromBase64(data), 'binaire', Infinity)
      : { text: redactBody(data), ...(dataEncoding && { encoding: dataEncoding }), truncated: truncated ?? false };
  return {
    ...base,
    data: content.text,
    ...(content.encoding && { dataEncoding: content.encoding }),
    ...((truncated || content.truncated) && { truncated: true }),
  };
}
