import { isRecord, parseJson } from '@/core/guards';
import { createLogger } from '@/core/log';
import { supabaseRealtimeAccess } from '@/site/api';

/**
 * Canal temps réel à nous (Supabase Realtime, protocole Phoenix `vsn=2.0.0` : trames JSON
 * `[join_ref, ref, topic, event, payload]`), sur notre propre WebSocket, avec la session du site. Pour suivre ce que
 * le site ne suit que sur une autre page (chat de guilde : `guild-chat:<id>`, rejoint par /guild seulement).
 * Rejoint comme le site rejoint ses canaux publics (`private: false`, mêmes `postgres_changes`) ; les changements
 * arrivent en JSON (seules les diffusions des canaux privés sont binaires).
 */
export interface PostgresChange {
  readonly event: 'INSERT' | 'UPDATE' | 'DELETE' | '*';
  readonly schema: string;
  readonly table: string;
  readonly filter?: string;
}

export interface RealtimeChange {
  /** `INSERT`, `UPDATE`, `DELETE`. */
  readonly type: string;
  readonly table: string;
  readonly record: Record<string, unknown>;
}

export interface RealtimeChannelOptions {
  /** Sans le préfixe `realtime:` (`guild-chat:<id>`). */
  readonly topic: string;
  readonly changes: readonly PostgresChange[];
  readonly onChange: (change: RealtimeChange) => void;
  /** Canal rejoint (après chaque connexion : des changements ont pu être manqués avant), ou connexion perdue. */
  readonly onStatus?: (status: 'joined' | 'lost') => void;
  readonly signal: AbortSignal;
}

export type RealtimeFrame = readonly [joinRef: string | null, ref: string | null, topic: string, event: string, payload: unknown];

/** Trame reçue, si c'en est une (les binaires et le reste sont ignorés). */
export function parseRealtimeFrame(data: unknown): RealtimeFrame | undefined {
  const raw = typeof data === 'string' ? parseJson(data) : undefined;
  if (!Array.isArray(raw) || raw.length !== 5) return undefined;
  const [joinRef, ref, topic, event, payload] = raw as unknown[];
  const isRef = (value: unknown) => value === null || typeof value === 'string';
  if (!isRef(joinRef) || !isRef(ref) || typeof topic !== 'string' || typeof event !== 'string') return undefined;
  return [joinRef, ref, topic, event, payload];
}

/** Changement d'une trame `postgres_changes`. */
export function parseRealtimeChange(payload: unknown): RealtimeChange | undefined {
  const data = isRecord(payload) ? payload.data : undefined;
  if (!isRecord(data) || typeof data.type !== 'string' || typeof data.table !== 'string' || !isRecord(data.record)) return undefined;
  return { type: data.type, table: data.table, record: data.record };
}

/** Message `phx_join` : la configuration que le client du site envoie pour un canal public. */
export function joinPayload(changes: readonly PostgresChange[], token: string): Record<string, unknown> {
  return {
    config: {
      broadcast: { ack: false, self: false },
      presence: { key: '', enabled: false },
      postgres_changes: changes,
      private: false,
    },
    access_token: token,
  };
}

const HEARTBEAT_MS = 25_000;
/** Nouvelles tentatives après une coupure, puis toutes les 30 s. */
const RETRY_MS = [2_000, 5_000, 15_000, 30_000];

const log = createLogger('realtime');

/** Rejoint le canal jusqu'à l'interruption de `signal`, en se reconnectant après une coupure. */
export function openRealtimeChannel(options: RealtimeChannelOptions): void {
  const { signal, topic: name, changes } = options;
  const topic = `realtime:${name}`;
  let socket: WebSocket | undefined;
  let heartbeat: ReturnType<typeof setInterval> | undefined;
  let retry: ReturnType<typeof setTimeout> | undefined;
  let attempt = 0;
  let counter = 0;
  let joined = false;

  const nextRef = () => String(++counter);

  function send(frame: RealtimeFrame): void {
    if (socket?.readyState === WebSocket.OPEN) socket.send(JSON.stringify(frame));
  }

  function schedule(): void {
    if (signal.aborted || retry !== undefined) return;
    const delay = RETRY_MS[Math.min(attempt, RETRY_MS.length - 1)] ?? 30_000;
    attempt++;
    retry = setTimeout(() => {
      retry = undefined;
      connect();
    }, delay);
  }

  function drop(): void {
    clearInterval(heartbeat);
    heartbeat = undefined;
    const current = socket;
    socket = undefined;
    if (current) {
      current.onopen = current.onmessage = current.onclose = current.onerror = null;
      current.close();
    }
    if (joined) {
      joined = false;
      options.onStatus?.('lost');
    }
  }

  function connect(): void {
    if (signal.aborted) return;
    const access = supabaseRealtimeAccess();
    // Session du site pas encore vue (il fait sa première requête Supabase au chargement).
    if (!access) return schedule();
    const joinRef = nextRef();
    let token = access.token;
    const ws = new WebSocket(access.url);
    socket = ws;
    ws.onopen = () => {
      send([joinRef, joinRef, topic, 'phx_join', joinPayload(changes, token)]);
      heartbeat = setInterval(() => {
        send([null, nextRef(), 'phoenix', 'heartbeat', {}]);
        const renewed = supabaseRealtimeAccess()?.token;
        if (renewed && renewed !== token) {
          token = renewed;
          send([joinRef, nextRef(), topic, 'access_token', { access_token: token }]);
        }
      }, HEARTBEAT_MS);
    };
    ws.onmessage = (event: MessageEvent) => {
      const frame = parseRealtimeFrame(event.data);
      if (!frame || frame[2] !== topic) return;
      const [, ref, , kind, payload] = frame;
      if (kind === 'phx_reply' && ref === joinRef) {
        if (isRecord(payload) && payload.status === 'ok') {
          joined = true;
          attempt = 0;
          options.onStatus?.('joined');
        } else {
          log.warn(`canal ${name} refusé`, payload);
          drop();
          schedule();
        }
      } else if (kind === 'postgres_changes') {
        const change = parseRealtimeChange(payload);
        if (change) options.onChange(change);
      } else if (kind === 'phx_error' || kind === 'phx_close') {
        drop();
        schedule();
      }
    };
    ws.onclose = () => {
      if (socket !== ws) return;
      drop();
      schedule();
    };
  }

  signal.addEventListener(
    'abort',
    () => {
      clearTimeout(retry);
      if (joined) send([null, nextRef(), topic, 'phx_leave', {}]);
      joined = false;
      drop();
    },
    { once: true },
  );
  connect();
}
