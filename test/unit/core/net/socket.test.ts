import { describe, expect, it } from 'vitest';
import { createNet, type SocketEvent } from '@/core/net';
import { flush, memoryLogger } from '../../support';

/** WebSocket minimal : pas de réseau, les événements sont déclenchés par le test. */
class FakeWebSocket extends EventTarget {
  static readonly OPEN = 1;
  readonly url: string;
  readonly sent: unknown[] = [];
  constructor(url: string | URL) {
    super();
    this.url = new URL(url).href;
  }
  send(data: unknown): void {
    this.sent.push(data);
  }
}

function setup() {
  const log = memoryLogger();
  const net = createNet(log);
  const win = {
    fetch: () => Promise.resolve(new Response('')),
    location: { href: 'https://www.wiki-masters.com/' },
    WebSocket: FakeWebSocket,
  } as unknown as Window & typeof globalThis;
  net.install(win);
  const open = (url = 'wss://x.supabase.co/realtime/v1/websocket?vsn=2.0.0') =>
    new win.WebSocket(url) as unknown as FakeWebSocket;
  return { net, log, open };
}

const close = (code: number) => Object.assign(new Event('close'), { code });

describe('observation des WebSocket', () => {
  it("signale ouverture, messages reçus et envoyés, fermeture, dans l'ordre", async () => {
    const { net, open } = setup();
    const events: Omit<SocketEvent, 'at'>[] = [];
    net.observeSocket(
      () => true,
      ({ at: _at, ...event }) => {
        events.push(event);
      },
    );

    const ws = open();
    ws.dispatchEvent(new Event('open'));
    ws.send('{"event":"phx_join"}');
    ws.dispatchEvent(new MessageEvent('message', { data: '{"event":"broadcast"}' }));
    ws.dispatchEvent(close(1000));
    await flush();

    const url = new URL('wss://x.supabase.co/realtime/v1/websocket?vsn=2.0.0');
    expect(events).toEqual([
      { url, type: 'open', seq: 1 },
      { url, type: 'message', direction: 'out', data: '{"event":"phx_join"}', seq: 2 },
      { url, type: 'message', direction: 'in', data: '{"event":"broadcast"}', seq: 3 },
      { url, type: 'close', code: 1000, seq: 4 },
    ]);
    expect(ws.sent).toEqual(['{"event":"phx_join"}']);
  });

  it('reste un WebSocket pour le site : même classe de base, mêmes constantes', () => {
    const { open } = setup();
    const ws = open();
    expect(ws).toBeInstanceOf(FakeWebSocket);
    expect((ws.constructor as typeof FakeWebSocket).OPEN).toBe(1);
  });

  it('copie un binaire envoyé : le site peut réutiliser son tampon', async () => {
    const { net, open } = setup();
    const data: unknown[] = [];
    net.observeSocket(
      () => true,
      (event) => {
        data.push(event.data);
      },
    );
    const buffer = new Uint8Array([1, 2, 3]);
    open().send(buffer);
    buffer[0] = 9;
    await flush();
    expect(new Uint8Array(data[0] as ArrayBuffer)).toEqual(new Uint8Array([1, 2, 3]));
  });

  it('ne notifie que les observateurs concernés, et isole leurs erreurs', async () => {
    const { net, log, open } = setup();
    const seen: string[] = [];
    net.observeSocket(
      () => true,
      () => {
        throw new Error('boum');
      },
    );
    net.observeSocket(
      (url) => url.hostname.endsWith('supabase.co'),
      (event) => {
        seen.push(event.url.hostname);
      },
    );

    open('wss://ailleurs.example/ws').dispatchEvent(new Event('open'));
    open().dispatchEvent(new Event('open'));
    await flush();

    expect(seen).toEqual(['x.supabase.co']);
    expect(log.errors).toHaveLength(2);
  });

  it('retire un observateur quand son signal est interrompu', async () => {
    const { net, open } = setup();
    const controller = new AbortController();
    const seen: string[] = [];
    net.observeSocket(
      () => true,
      (event) => {
        seen.push(event.type);
      },
      { signal: controller.signal },
    );
    const ws = open();
    ws.dispatchEvent(new Event('open'));
    controller.abort();
    ws.dispatchEvent(close(1000));
    await flush();
    expect(seen).toEqual(['open']);
  });
});
