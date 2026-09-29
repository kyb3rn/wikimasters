import { errorMessage } from '@/core/log';
import type { NetExchange, NetRequest, SocketData, SocketEvent } from '@/core/net';
import { binaryContent, socketBinaryContent, textContent, type Content } from './content';
import { redactBody, redactHeaders, redactUrl } from './redact';

/** Un échange réseau enregistré, secrets masqués. */
export interface RecordedExchange {
  /** Départ de la requête (ISO). */
  readonly at: string;
  readonly method: string;
  readonly url: string;
  readonly own: boolean;
  readonly synthetic: boolean;
  readonly status: number;
  readonly duration: number;
  readonly requestHeaders: Record<string, string>;
  readonly requestBody?: string;
  readonly responseHeaders: Record<string, string>;
  /** Corps de la réponse : texte, ou contenu exact d'un fichier binaire en base64 (voir `bodyEncoding`). */
  readonly body: string;
  /** Présent pour un fichier binaire (son, image, police…) : `body` est en base64. */
  readonly bodyEncoding?: 'base64';
  /** Texte coupé à `maxBodyChars`, ou fichier binaire trop gros pour être gardé. */
  readonly truncated: boolean;
}

/** Un événement WebSocket enregistré (temps réel du site), secrets masqués. */
export interface RecordedSocketEvent {
  /** Ordre réel des événements, tous WebSocket confondus. */
  readonly seq: number;
  readonly at: string;
  readonly url: string;
  readonly type: 'open' | 'message' | 'close';
  readonly direction?: 'in' | 'out';
  /**
   * Message : texte ; diffusion Supabase Realtime binaire décodée en JSON `{ topic, event, metadata, payload }`
   * (`dataEncoding: 'realtime'`) ; autre binaire en base64 (`dataEncoding: 'base64'`).
   */
  readonly data?: string;
  readonly dataEncoding?: 'base64' | 'realtime';
  readonly truncated?: boolean;
  readonly code?: number;
}

export interface RecorderLimits {
  readonly maxEntries: number;
  readonly maxBodyChars: number;
  /** Au-delà, les plus anciens échanges sont oubliés. */
  readonly maxTotalChars: number;
  readonly maxSocketEvents: number;
}

export interface Recorder {
  add(entry: RecordedExchange): void;
  addSocket(event: RecordedSocketEvent): void;
  list(): readonly RecordedExchange[];
  /** Événements WebSocket, dans l'ordre où ils se sont produits. */
  sockets(): readonly RecordedSocketEvent[];
  clear(): void;
}

export function createRecorder(limits: RecorderLimits): Recorder {
  let entries: RecordedExchange[] = [];
  let socketEvents: RecordedSocketEvent[] = [];
  let total = 0;

  return {
    add(entry) {
      entries.push(entry);
      total += entry.body.length;
      while (entries.length > limits.maxEntries || (total > limits.maxTotalChars && entries.length > 1)) {
        const dropped = entries.shift();
        if (dropped) total -= dropped.body.length;
      }
    },
    addSocket(event) {
      socketEvents.push(event);
      // Les binaires sont lus de façon asynchrone : l'ordre d'arrivée n'est pas l'ordre réel.
      socketEvents.sort((a, b) => a.seq - b.seq);
      if (socketEvents.length > limits.maxSocketEvents) socketEvents.shift();
    },
    list: () => [...entries],
    sockets: () => [...socketEvents],
    clear() {
      entries = [];
      socketEvents = [];
      total = 0;
    },
  };
}

/** Requêtes utiles à une capture : tout sauf les fichiers statiques de Next.js. */
export function isRecordable(request: NetRequest): boolean {
  return request.url.protocol.startsWith('http') && !request.url.pathname.startsWith('/_next/static/');
}

/** Types lisibles en texte ; sans type déclaré, on tente la lecture en texte. */
const TEXTUAL = /^(text\/|application\/([\w.+-]*\+)?(json|javascript|xml|x-www-form-urlencoded)\b)/i;

export async function toRecord(exchange: NetExchange, maxBodyChars: number): Promise<RecordedExchange> {
  const type = exchange.headers.get('content-type');
  let body: Content;
  try {
    body =
      type && !TEXTUAL.test(type)
        ? binaryContent(new Uint8Array(await exchange.arrayBuffer()), type, maxBodyChars)
        : textContent(await exchange.text(), maxBodyChars);
  } catch (error) {
    body = { text: `[corps illisible : ${errorMessage(error)}]`, truncated: false };
  }
  const { request } = exchange;
  return {
    at: new Date(exchange.startedAt).toISOString(),
    method: request.method,
    url: redactUrl(request.url.href),
    own: request.own,
    synthetic: exchange.synthetic,
    status: exchange.status,
    duration: exchange.duration,
    requestHeaders: redactHeaders(request.headers),
    ...(request.body !== undefined && { requestBody: redactBody(request.body) }),
    responseHeaders: redactHeaders(exchange.headers),
    body: body.text,
    ...(body.encoding === 'base64' && { bodyEncoding: 'base64' as const }),
    truncated: body.truncated,
  };
}

export async function toSocketRecord(event: SocketEvent, maxChars: number): Promise<RecordedSocketEvent> {
  const base = {
    seq: event.seq,
    at: new Date(event.at).toISOString(),
    url: redactUrl(event.url.href),
    type: event.type,
    ...(event.direction && { direction: event.direction }),
    ...(event.code !== undefined && { code: event.code }),
  };
  if (event.data === undefined) return base;
  let data: Content;
  try {
    data = await socketContent(event.data, maxChars);
  } catch (error) {
    data = { text: `[message illisible : ${errorMessage(error)}]`, truncated: false };
  }
  return {
    ...base,
    data: data.text,
    ...(data.encoding && { dataEncoding: data.encoding }),
    ...(data.truncated && { truncated: true }),
  };
}

async function socketContent(data: SocketData, maxChars: number): Promise<Content> {
  if (typeof data === 'string') return textContent(data, maxChars);
  if (data instanceof Blob) {
    return socketBinaryContent(new Uint8Array(await data.arrayBuffer()), data.type || 'binaire', maxChars);
  }
  return socketBinaryContent(new Uint8Array(data), 'binaire', maxChars);
}
