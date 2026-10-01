import type { Logger } from '@/core/log';
import { net, type NetRequest } from '@/core/net';
import type { Fiber } from '@/core/react';
import type { RecordedExchange } from '@/features/debug';
import type { Friendship, Sale } from '@/site/api';

const SITE = 'https://www.wiki-masters.com';

/** Journal muet qui garde les messages, pour vérifier qu'une erreur a bien été signalée. */
export function memoryLogger(): Logger & { readonly errors: unknown[][]; readonly warnings: unknown[][] } {
  const errors: unknown[][] = [];
  const warnings: unknown[][] = [];
  return {
    errors,
    warnings,
    debug: () => {},
    info: () => {},
    warn: (...args) => warnings.push(args),
    error: (...args) => errors.push(args),
  };
}

/** Diffusion Supabase Realtime binaire, telle que le serveur l'envoie (voir `site/realtime`). */
export function realtimeFrame(topic: string, event: string, metadata: unknown, payload: unknown): Uint8Array {
  const utf8 = new TextEncoder();
  const [t, e, m, p] = [topic, event, JSON.stringify(metadata), JSON.stringify(payload)].map((s) => utf8.encode(s)) as [
    Uint8Array,
    Uint8Array,
    Uint8Array,
    Uint8Array,
  ];
  return Uint8Array.from([4, t.length, e.length, m.length, 1, ...t, ...e, ...m, ...p]);
}

/** Laisse passer les microtâches et tâches en attente (observateurs réseau, promesses). */
export function flush(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/**
 * Requête telle que `core/net` la décrit aux intercepteurs et observateurs : adresse relative résolue sur le site,
 * GET, sans en-têtes, venue du site (pas `own`). Corps : un texte tel quel, toute autre valeur en JSON.
 */
export function netRequest(
  url: string | URL,
  { method = 'GET', headers, body, own = false }: { method?: string; headers?: HeadersInit; body?: unknown; own?: boolean } = {},
): NetRequest {
  return {
    url: new URL(url, SITE),
    method,
    headers: new Headers(headers),
    body: body === undefined || typeof body === 'string' ? body : JSON.stringify(body),
    own,
  };
}

/**
 * Composant React à états imité : ses hooks d'état dans l'ordre (liste chaînée `memoizedState`, `queue.dispatch`,
 * `next`, comme `stateHooks` la lit). `calls[i]` : valeurs passées au `set` du i-ième.
 */
export function stateComponent(props: unknown, ...values: unknown[]): { readonly fiber: Fiber; readonly calls: unknown[][] } {
  const calls: unknown[][] = values.map(() => []);
  const memoizedState = values.reduceRight<unknown>(
    (next, value, i) => ({ memoizedState: value, queue: { dispatch: (state: unknown) => calls[i]?.push(state) }, next }),
    null,
  );
  return { fiber: { memoizedProps: props, return: null, memoizedState }, calls };
}

/** Fiber sans état : élément du DOM, composant sans hook. */
export function statelessFiber(): Fiber {
  return { memoizedProps: {}, return: null };
}

/** `localStorage` imité, en mémoire ; `data` : ce qui y est écrit. */
export function fakeStorage(initial: Record<string, string> = {}): Pick<Storage, 'getItem' | 'setItem'> & {
  readonly data: Map<string, string>;
} {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => data.get(key) ?? null,
    setItem: (key, value) => void data.set(key, value),
  };
}

/** Échange enregistré dans une capture : `GET` réussi, corps JSON vide, sauf ce que donne `init`. */
export function recordedExchange(init: Partial<RecordedExchange> = {}): RecordedExchange {
  return {
    at: '2026-09-29T03:40:48.000Z',
    method: 'GET',
    url: `${SITE}/api/x`,
    own: false,
    synthetic: false,
    status: 200,
    duration: 10,
    requestHeaders: {},
    responseHeaders: { 'content-type': 'application/json' },
    body: '{}',
    truncated: false,
    ...init,
  };
}

/** Amitié telle que `GET /api/friends` la donne ; chaque joueur a son id pour pseudo. */
export function friendship(id: string, status: string, requester: string, addressee: string): Friendship {
  return {
    id,
    status,
    requester_id: requester,
    addressee_id: addressee,
    requester: { id: requester, username: requester },
    addressee: { id: addressee, username: addressee },
  };
}

export const DAY = 86_400_000;
/** « Maintenant » des historiques de ventes. */
export const SALES_NOW = Date.parse('2026-09-30T12:00:00Z');

/** Vente d'il y a `daysAgo` jours (avant `SALES_NOW`). */
export function sale(price: number, daysAgo: number, rarity = 'R'): Sale {
  return { id: `${price}-${daysAgo}`, price, time: SALES_NOW - daysAgo * DAY, rarity };
}

/**
 * Branche le réseau du script (`net`) sur un faux site ouvert à `page` : `reply` répond à chaque requête
 * (`undefined` : pas de réponse, erreur réseau). Rend le `fetch` de la page : ses requêtes sont celles du site
 * (pas `own`) ; celles de `net.fetch` passent par le même faux site.
 */
export function connectFakeSite(page: string, reply: (url: URL, init: RequestInit | undefined) => Response | undefined): typeof fetch {
  const win = {
    location: { href: page },
    fetch: (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
      const response = reply(new URL(input instanceof Request ? input.url : String(input), page), init);
      return response ? Promise.resolve(response) : Promise.reject(new TypeError('Failed to fetch'));
    },
  };
  net.install(win as unknown as Window & typeof globalThis);
  // `install` a remplacé `fetch` par celui qui passe par `net`.
  return win.fetch;
}
