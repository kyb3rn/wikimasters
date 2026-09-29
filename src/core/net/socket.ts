import type { Logger } from '@/core/log';
import type { ListenOptions, SocketData, SocketEvent, SocketMatcher, SocketObserver } from './types';

export interface Sockets {
  observe(match: SocketMatcher, observer: SocketObserver, options?: ListenOptions): void;
  /** Remplace `window.WebSocket` par une sous-classe qui signale ses événements. */
  install(win: Window & typeof globalThis): void;
}

interface Entry {
  readonly match: SocketMatcher;
  readonly fn: SocketObserver;
}

type SendData = Parameters<WebSocket['send']>[0];

/**
 * Observation des WebSocket de la page. Le site y reçoit son temps réel (Supabase Realtime) :
 * nouvelles mises, notifications, changements de solde. Lecture seule : les messages passent
 * tels quels ; les observateurs sont appelés après coup, dans l'ordre des événements.
 */
export function createSockets(log: Logger): Sockets {
  const observers = new Set<Entry>();
  let seq = 0;

  function emit(event: Omit<SocketEvent, 'seq' | 'at'>): void {
    const targets = [...observers].filter(({ match }) => {
      try {
        return match(event.url);
      } catch (error) {
        log.error('filtre de WebSocket en échec', error);
        return false;
      }
    });
    if (targets.length === 0) return;
    const full: SocketEvent = { ...event, seq: ++seq, at: Date.now() };
    const fail = (error: unknown) => log.error('observateur de WebSocket en échec', full.url.href, error);
    queueMicrotask(() => {
      for (const { fn } of targets) {
        try {
          Promise.resolve(fn(full)).catch(fail);
        } catch (error) {
          fail(error);
        }
      }
    });
  }

  return {
    observe(match, fn, options) {
      const signal = options?.signal;
      if (signal?.aborted) return;
      const entry = { match, fn };
      observers.add(entry);
      signal?.addEventListener('abort', () => observers.delete(entry), { once: true });
    },

    install(win) {
      const Native = win.WebSocket as typeof WebSocket | undefined;
      if (typeof Native !== 'function') return;
      class ObservedWebSocket extends Native {
        readonly #target: URL;

        constructor(url: string | URL, protocols?: string | string[]) {
          super(url, protocols);
          const target = new URL(this.url);
          this.#target = target;
          this.addEventListener('open', () => emit({ url: target, type: 'open' }));
          this.addEventListener('message', (event: MessageEvent<SocketData>) =>
            emit({ url: target, type: 'message', direction: 'in', data: event.data }),
          );
          this.addEventListener('close', (event: CloseEvent) => emit({ url: target, type: 'close', code: event.code }));
        }

        override send(data: SendData): void {
          super.send(data);
          emit({ url: this.#target, type: 'message', direction: 'out', data: snapshot(data) });
        }
      }
      win.WebSocket = ObservedWebSocket;
    },
  };
}

/** Copie d'un message envoyé : le site peut réutiliser son tampon juste après. */
function snapshot(data: SendData): SocketData {
  if (typeof data === 'string' || data instanceof Blob) return data;
  const bytes = ArrayBuffer.isView(data)
    ? new Uint8Array(data.buffer, data.byteOffset, data.byteLength)
    : new Uint8Array(data);
  return bytes.slice().buffer;
}
