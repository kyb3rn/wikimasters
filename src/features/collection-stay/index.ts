import { watchDom, whenBody } from '@/core/dom';
import { net, type NetExchange } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { findCardModals, readAuctionCreation, readDiscard } from '@/site/cards';
import {
  COLLECTION_ROUTE,
  findCollectionFaces,
  isCollectionList,
  isCollectionStats,
  parseCollection,
  type CollectionEntry,
} from '@/site/collection';
import { lockControl, unlockAll } from '@/ui/lock';
import { stampedFaces, stampFace, unstampAll, type Stamp } from '@/ui/stamp';

const OWNER = 'collection-stay';
/** Le site recharge la liste dès la réponse de l'action : au-delà, une requête n'est plus ce rechargement. */
const QUIET_MS = 3000;
/** Réponses gardées, une par adresse (liste et compteurs, plusieurs pages ou filtres). */
const CACHE_SIZE = 8;

type Action = 'discarded' | 'listed';

interface Cached {
  readonly body: string;
  readonly contentType: string;
}

const normalize = (text: string | undefined) => (text ?? '').replace(/\s+/g, ' ').trim();

/** Un exemplaire sur plusieurs : la carte reste dans la collection. */
function stampOf(action: Action, count: number): Stamp {
  if (action === 'discarded') return { label: count > 1 ? '1 défaussée' : 'Défaussée', tone: 'danger' };
  return { label: count > 1 ? '1 en vente' : 'En vente', tone: 'success' };
}

export const collectionStay: Feature = {
  id: 'collection-stay',
  name: 'Collection sans rechargement',
  description:
    "Après une défausse ou une mise aux enchères, la liste n'est pas rechargée : la carte reste, marquée « Défaussée » ou « En vente », jusqu'au prochain chargement de la liste.",
  category: 'Général',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    const cache = new Map<string, Cached>();
    /** Exemplaires défaussés ou mis en vente depuis cette page. */
    const done = new Map<string, Action>();
    /** Rechargement attendu : chaque requête (liste, compteurs) n'est resservie qu'une fois. */
    let quiet: { until: number; served: Set<'list' | 'stats'> } | undefined;
    /** Dernière liste demandée, et celle affichée (sa réponse). */
    let requested: string | undefined;
    let shown: CollectionEntry[] = [];

    function remember(exchange: NetExchange, body: string): void {
      const href = exchange.request.url.href;
      cache.delete(href);
      cache.set(href, { body, contentType: exchange.headers.get('content-type') ?? 'application/json' });
      for (const oldest of cache.keys()) {
        if (cache.size <= CACHE_SIZE) break;
        cache.delete(oldest);
      }
    }

    net.track(
      isCollectionList,
      (request) => {
        requested = request.url.href;
      },
      { signal },
    );
    net.observe(
      (request) => isCollectionList(request) || isCollectionStats(request),
      async (exchange) => {
        if (!exchange.ok) return;
        const body = await exchange.text();
        if (!exchange.synthetic) remember(exchange, body);
        // Une réponse d'une liste abandonnée entre-temps (autre filtre) n'est pas celle affichée.
        if (!isCollectionList(exchange.request) || exchange.request.url.href !== requested) return;
        try {
          shown = parseCollection(JSON.parse(body)) ?? [];
        } catch {
          shown = [];
        }
        sync();
      },
      { signal },
    );

    // Défausse ou mise aux enchères réussie : le rechargement qui suit reçoit la liste déjà affichée.
    net.track(
      (request) => !request.own && (readDiscard(request) !== undefined || readAuctionCreation(request) !== undefined),
      (request) => {
        const discard = readDiscard(request);
        const id = discard?.userCardId ?? readAuctionCreation(request)?.userCardId;
        const action: Action = discard ? 'discarded' : 'listed';
        return (status) => {
          if (!id || status === undefined || status >= 400) return;
          done.set(id, action);
          quiet = { until: performance.now() + QUIET_MS, served: new Set() };
          sync();
        };
      },
      { signal },
    );
    net.intercept(
      (request) => isCollectionList(request) || isCollectionStats(request),
      (request) => {
        const kind = isCollectionList(request) ? 'list' : 'stats';
        if (!quiet || performance.now() > quiet.until || quiet.served.has(kind)) return undefined;
        const cached = cache.get(request.url.href);
        if (!cached) return undefined;
        quiet.served.add(kind);
        log.debug('rechargement évité', request.url.pathname + request.url.search);
        return new Response(cached.body, { status: 200, headers: { 'content-type': cached.contentType } });
      },
      { signal },
    );

    await whenBody();
    if (signal.aborted) return;

    /** Tampons sur la grille ; modale d'un exemplaire défaussé verrouillée (il n'existe plus). Idempotent. */
    function sync(): void {
      if (signal.aborted) return;
      const wanted = new Map<HTMLElement, Stamp>();
      const faces = findCollectionFaces();
      // Grille en cours de remplacement (autre page, autre filtre) : rien à marquer.
      if (faces.length === shown.length) {
        shown.forEach((entry, index) => {
          const action = done.get(entry.id);
          const face = faces[index];
          if (action && face && normalize(face.querySelector('h3')?.textContent ?? '') === normalize(entry.title)) {
            wanted.set(face, stampOf(action, entry.count));
          }
        });
      }
      const discarded = new Set(shown.filter((entry) => done.get(entry.id) === 'discarded').map((entry) => normalize(entry.title)));
      for (const modal of findCardModals()) {
        const locked = discarded.has(normalize(modal.title));
        for (const control of [modal.discardButton, modal.auctionButton, modal.tagInput]) {
          if (control) lockControl(control, { owner: OWNER, locked, reason: 'Carte déjà défaussée' });
        }
        if (locked && modal.face) wanted.set(modal.face, { ...stampOf('discarded', 1), revealable: true });
      }
      for (const face of stampedFaces(OWNER)) if (!wanted.has(face)) stampFace(face, OWNER, undefined);
      for (const [face, stamp] of wanted) stampFace(face, OWNER, stamp);
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      unstampAll(OWNER);
      unlockAll(OWNER);
    });
  },
};
