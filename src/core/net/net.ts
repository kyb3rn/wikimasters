import type { Logger } from '@/core/log';
import { createSockets } from './socket';
import type {
  Interceptor,
  ListenOptions,
  Matcher,
  Net,
  NetExchange,
  NetRequest,
  Observer,
  Tracker,
  Transport,
} from './types';

export interface NetController extends Net {
  /** Remplace `window.fetch` et `window.WebSocket` : tout le trafic du site passe désormais par ici. */
  install(win: Window & typeof globalThis): void;
  /** Branche un transport sans toucher à `window` (tests). */
  connect(transport: Transport, baseUrl: () => string): void;
}

interface Entry<F> {
  readonly match: Matcher;
  readonly fn: F;
}

/**
 * Point de passage unique des requêtes, dans un ordre fixe :
 *
 *   1. intercepteurs, dans l'ordre d'inscription : le premier qui renvoie une réponse
 *      court-circuite le réseau ;
 *   2. transport (le `fetch` d'origine) ;
 *   3. observateurs, après avoir rendu la réponse à l'appelant.
 *
 * Une erreur dans un intercepteur ou un observateur est journalisée et ignorée :
 * la requête du site passe toujours.
 *
 * Les WebSocket (temps réel) sont observés à part, en lecture seule (`socket.ts`).
 */
export function createNet(log: Logger): NetController {
  const interceptors = new Set<Entry<Interceptor>>();
  const observers = new Set<Entry<Observer>>();
  const trackers = new Set<Entry<Tracker>>();
  const sockets = createSockets(log);
  let transport: Transport | undefined;
  let baseUrl: () => string = () => 'http://localhost/';

  function add<F>(set: Set<Entry<F>>, entry: Entry<F>, options?: ListenOptions): void {
    const signal = options?.signal;
    if (signal?.aborted) return;
    set.add(entry);
    signal?.addEventListener('abort', () => set.delete(entry), { once: true });
  }

  function matches(match: Matcher, request: NetRequest): boolean {
    try {
      return match(request);
    } catch (error) {
      log.error('filtre de requête en échec', error);
      return false;
    }
  }

  async function run(input: RequestInfo | URL, init: RequestInit | undefined, own: boolean): Promise<Response> {
    if (!transport) throw new Error('réseau non installé');
    const request = describe(input, init, own, baseUrl());
    // Adresse illisible : on laisse fetch produire son erreur habituelle.
    if (!request) return transport(input, init);

    const startedAt = Date.now();
    const ends = track(request);
    let response: Response | undefined;
    try {
      for (const { match, fn } of [...interceptors]) {
        if (!matches(match, request)) continue;
        try {
          response = await fn(request);
        } catch (error) {
          log.error('intercepteur en échec', request.method, request.url.href, error);
        }
        if (response) break;
      }
      const synthetic = response !== undefined;
      response ??= await transport(input, init);
      notify(request, response, synthetic, startedAt);
      return response;
    } finally {
      for (const end of ends) {
        try {
          end(response?.status);
        } catch (error) {
          log.error('suivi de requête en échec', request.method, request.url.href, error);
        }
      }
    }
  }

  /** Prévient les suivis au départ de la requête ; renvoie de quoi les prévenir de sa fin. */
  function track(request: NetRequest): ((status: number | undefined) => void)[] {
    const ends: ((status: number | undefined) => void)[] = [];
    for (const { match, fn } of [...trackers]) {
      if (!matches(match, request)) continue;
      try {
        const end = fn(request);
        if (end) ends.push(end);
      } catch (error) {
        log.error('suivi de requête en échec', request.method, request.url.href, error);
      }
    }
    return ends;
  }

  function notify(request: NetRequest, response: Response, synthetic: boolean, startedAt: number): void {
    const targets = [...observers].filter((o) => matches(o.match, request));
    if (targets.length === 0) return;

    let copy: Response;
    try {
      copy = response.clone();
    } catch (error) {
      log.warn('réponse non clonable, observateurs ignorés', request.url.href, error);
      return;
    }
    let body: Promise<ArrayBuffer> | undefined;
    const exchange: NetExchange = {
      request,
      status: response.status,
      ok: response.ok,
      headers: response.headers,
      synthetic,
      startedAt,
      duration: Date.now() - startedAt,
      arrayBuffer: () => (body ??= copy.arrayBuffer()),
      text: async () => new TextDecoder().decode(await exchange.arrayBuffer()),
      json: async () => JSON.parse(await exchange.text()) as unknown,
    };
    // Tâche suivante, pas microtâche : le code du site qui attend cette réponse passe d'abord.
    setTimeout(() => {
      for (const { fn } of targets) {
        Promise.resolve()
          .then(() => fn(exchange))
          .catch((error: unknown) => log.error('observateur en échec', request.method, request.url.href, error));
      }
    }, 0);
  }

  function connect(next: Transport, base: () => string): void {
    transport = next;
    baseUrl = base;
  }

  return {
    fetch: (input, init) => run(input, init, true),
    intercept: (match, fn, options) => add(interceptors, { match, fn }, options),
    observe: (match, fn, options) => add(observers, { match, fn }, options),
    track: (match, fn, options) => add(trackers, { match, fn }, options),
    observeSocket: (match, fn, options) => sockets.observe(match, fn, options),
    connect,
    install(win) {
      connect(win.fetch.bind(win), () => win.location.href);
      win.fetch = (input, init) => run(input, init, false);
      sockets.install(win);
    },
  };
}

/** Décrit une requête sans consommer son corps. `undefined` si l'adresse est illisible. */
function describe(input: RequestInfo | URL, init: RequestInit | undefined, own: boolean, base: string): NetRequest | undefined {
  const source = input instanceof Request ? input : undefined;
  const href = input instanceof Request ? input.url : input instanceof URL ? input.href : input;
  let url: URL;
  try {
    url = new URL(href, base);
  } catch {
    return undefined;
  }
  // Comme fetch : les en-têtes de `init` remplacent ceux de la Request.
  const headers = new Headers(init?.headers ?? source?.headers);
  return {
    url,
    method: (init?.method ?? source?.method ?? 'GET').toUpperCase(),
    headers,
    body: typeof init?.body === 'string' ? init.body : undefined,
    own,
  };
}
