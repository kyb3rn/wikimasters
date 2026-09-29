import { describe, expect, it, vi } from 'vitest';
import { createNet, type NetExchange } from '@/core/net';
import { flush, memoryLogger } from '../../support';

const BASE = 'https://www.wiki-masters.com/marketplace';

function setup() {
  const log = memoryLogger();
  const net = createNet(log);
  const transport = vi.fn((_input: RequestInfo | URL, _init?: RequestInit) =>
    Promise.resolve(Response.json({ from: 'réseau' })),
  );
  net.connect(transport, () => BASE);
  return { net, log, transport };
}

describe('createNet', () => {
  it("refuse de fonctionner avant d'être branché", async () => {
    const net = createNet(memoryLogger());
    await expect(net.fetch('/api/x')).rejects.toThrow('réseau non installé');
  });

  it('décrit la requête : adresse absolue, méthode en majuscules, en-têtes, corps texte', async () => {
    const { net } = setup();
    let seen: NetExchange | undefined;
    net.observe(() => true, (exchange) => {
      seen = exchange;
    });

    await net.fetch('/api/marketplace?page=2', {
      method: 'post',
      headers: { 'Content-Type': 'application/json' },
      body: '{"a":1}',
    });
    await flush();

    expect(seen?.request.url.href).toBe('https://www.wiki-masters.com/api/marketplace?page=2');
    expect(seen?.request.method).toBe('POST');
    expect(seen?.request.headers.get('content-type')).toBe('application/json');
    expect(seen?.request.body).toBe('{"a":1}');
    expect(seen?.request.own).toBe(true);
  });

  it('lit la méthode et les en-têtes d’une Request', async () => {
    const { net } = setup();
    let seen: NetExchange | undefined;
    net.observe(() => true, (exchange) => {
      seen = exchange;
    });

    await net.fetch(new Request('https://x.supabase.co/rest/v1/cards', { method: 'PATCH', headers: { apikey: 'k' } }));
    await flush();

    expect(seen?.request.method).toBe('PATCH');
    expect(seen?.request.headers.get('apikey')).toBe('k');
  });

  it('court-circuite le réseau avec la réponse du premier intercepteur qui en donne une', async () => {
    const { net, transport } = setup();
    const second = vi.fn(() => Response.json({ from: 'second' }));
    net.intercept(() => true, () => undefined);
    net.intercept(
      (r) => r.url.pathname === '/api/marketplace',
      () => Response.json({ from: 'intercepteur' }),
    );
    net.intercept(() => true, second);

    const response = await net.fetch('/api/marketplace');
    expect(await response.json()).toEqual({ from: 'intercepteur' });
    expect(transport).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
  });

  it('laisse passer la requête si un intercepteur échoue', async () => {
    const { net, log } = setup();
    net.intercept(
      () => true,
      () => {
        throw new Error('boum');
      },
    );
    const response = await net.fetch('/api/x');
    expect(await response.json()).toEqual({ from: 'réseau' });
    expect(log.errors).toHaveLength(1);
  });

  it("donne le corps aux observateurs sans le retirer à l'appelant", async () => {
    const { net } = setup();
    const bodies: unknown[] = [];
    net.observe(() => true, async (exchange) => {
      bodies.push(await exchange.json());
    });
    net.observe(() => true, async (exchange) => {
      bodies.push(await exchange.text());
    });

    const response = await net.fetch('/api/x');
    expect(await response.json()).toEqual({ from: 'réseau' });
    await flush();
    await flush();
    expect(bodies).toHaveLength(2);
    expect(bodies).toContainEqual({ from: 'réseau' });
    expect(bodies).toContainEqual('{"from":"réseau"}');
  });

  it('signale aux observateurs une réponse fabriquée par un intercepteur', async () => {
    const { net } = setup();
    const synthetic: boolean[] = [];
    net.intercept(() => true, () => new Response('{}'));
    net.observe(() => true, (exchange) => {
      synthetic.push(exchange.synthetic);
    });
    await net.fetch('/api/x');
    await flush();
    expect(synthetic).toEqual([true]);
  });

  it("appelle les observateurs après la suite de l'appelant, et isole leurs erreurs", async () => {
    const { net, log } = setup();
    const order: string[] = [];
    net.observe(() => true, () => {
      order.push('observateur');
      throw new Error('boum');
    });

    await net.fetch('/api/x');
    order.push('appelant');
    await flush();

    expect(order).toEqual(['appelant', 'observateur']);
    expect(log.errors).toHaveLength(1);
  });

  it('ne notifie que les observateurs dont le filtre correspond', async () => {
    const { net } = setup();
    const seen: string[] = [];
    net.observe((r) => r.url.pathname.startsWith('/api/packs'), (e) => {
      seen.push(e.request.url.pathname);
    });
    await net.fetch('/api/marketplace');
    await net.fetch('/api/packs/open', { method: 'POST' });
    await flush();
    expect(seen).toEqual(['/api/packs/open']);
  });

  it('retire intercepteurs et observateurs quand leur signal est interrompu', async () => {
    const { net, transport } = setup();
    const controller = new AbortController();
    const observer = vi.fn();
    net.intercept(() => true, () => new Response('intercepté'), { signal: controller.signal });
    net.observe(() => true, observer, { signal: controller.signal });

    controller.abort();
    await net.fetch('/api/x');
    await flush();

    expect(transport).toHaveBeenCalledOnce();
    expect(observer).not.toHaveBeenCalled();
  });

  it('suit une requête de son départ à sa fin, avant que l’appelant ne reçoive la réponse', async () => {
    const { net } = setup();
    const events: string[] = [];
    net.track(
      (r) => r.url.pathname === '/api/x',
      (request) => {
        events.push(`départ ${request.method}`);
        return (status) => events.push(`fin ${status}`);
      },
    );
    const pending = net.fetch('/api/x', { method: 'POST' });
    expect(events).toEqual(['départ POST']);
    await pending;
    events.push('appelant');
    await net.fetch('/api/autre');
    expect(events).toEqual(['départ POST', 'fin 200', 'appelant']);
  });

  it('prévient aussi de la fin sur un échec réseau (sans statut), et isole les erreurs du suivi', async () => {
    const { net, log, transport } = setup();
    transport.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const ends: (number | undefined)[] = [];
    net.track(() => true, () => (status) => ends.push(status));
    net.track(
      () => true,
      () => {
        throw new Error('boum');
      },
    );
    await expect(net.fetch('/api/x')).rejects.toThrow('Failed to fetch');
    await net.fetch('/api/x');
    expect(ends).toEqual([undefined, 200]);
    expect(log.errors).toHaveLength(2);
  });

  it('install remplace window.fetch : les requêtes du site ne sont pas marquées « own »', async () => {
    const log = memoryLogger();
    const net = createNet(log);
    const native = vi.fn(() => Promise.resolve(new Response('ok')));
    const win = { fetch: native, location: { href: BASE } } as unknown as Window & typeof globalThis;
    const own: boolean[] = [];
    net.install(win);
    net.observe(() => true, (e) => {
      own.push(e.request.own);
    });

    await win.fetch('/api/x');
    await net.fetch('/api/y');
    await flush();

    expect(native).toHaveBeenCalledTimes(2);
    expect(own).toEqual([false, true]);
  });
});
