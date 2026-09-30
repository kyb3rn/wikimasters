import { watchDom, whenBody } from '@/core/dom';
import { net, type NetExchange } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { findCardModals, readAuctionCreation, readDiscard } from '@/site/cards';
import {
  COLLECTION_ROUTE,
  findCollectionFaces,
  isBulkDiscard,
  isCollectionList,
  isCollectionStats,
  parseCollection,
  readBulkDiscard,
  readBulkDiscardFailures,
  selectionMarkOf,
  type CollectionEntry,
} from '@/site/collection';
import { lockControl, unlockAll } from '@/ui/lock';
import { stampedFaces, stampFace, unstampAll, type Stamp } from '@/ui/stamp';

const OWNER = 'collection-stay';
/** Le site recharge la liste dès la réponse de l'action : au-delà, une requête n'est plus ce rechargement. */
const QUIET_MS = 3000;
/** Réponses gardées, une par adresse (liste et compteurs, plusieurs pages ou filtres). */
const CACHE_SIZE = 8;
/** Une carte décochée par le script ne l'est pas deux fois avant que le site ait redessiné. */
const DESELECT_GAP_MS = 500;

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
    "Après une défausse (même de toute la sélection) ou une mise aux enchères, la liste n'est pas rechargée : la carte reste, marquée « Défaussée » ou « En vente », jusqu'au prochain chargement de la liste. Elle ne se sélectionne plus.",
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
    /** Faces de la grille d'exemplaires défaussés ou mis en vente (tamponnées). */
    let doneFaces = new Set<HTMLElement>();
    const deselectedAt = new WeakMap<HTMLElement, number>();

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
    // Défausse de la sélection : de même, chaque exemplaire défaussé reste, tamponné.
    net.track(
      (request) => !request.own && isBulkDiscard(request),
      (request) => {
        const ids = readBulkDiscard(request);
        return (status) => {
          if (ids.length === 0 || status === undefined || status >= 400) return;
          for (const id of ids) done.set(id, 'discarded');
          quiet = { until: performance.now() + QUIET_MS, served: new Set() };
          sync();
        };
      },
      { signal },
    );
    net.observe(
      (request) => !request.own && isBulkDiscard(request),
      async (exchange) => {
        if (!exchange.ok) return;
        const failed = readBulkDiscardFailures(await exchange.json().catch(() => undefined));
        if (failed.length === 0) return;
        log.debug('exemplaires non défaussés', failed);
        for (const id of failed) done.delete(id);
        sync();
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

    // En sélection, un exemplaire défaussé ou mis en vente ne se coche plus : il n'existe plus pour le site.
    window.addEventListener(
      'click',
      (event) => {
        if (!event.isTrusted || !(event.target instanceof Element)) return;
        const target = event.target;
        // En sélection seulement : chaque case a alors son calque de sélection.
        if (![...doneFaces].some((face) => face.contains(target) && selectionMarkOf(face))) return;
        event.preventDefault();
        event.stopImmediatePropagation();
      },
      { capture: true, signal },
    );

    /** Coché quand même (« Sélectionner toute la page ») : décoché aussitôt, par le clic que le site attend. */
    function deselectDone(): void {
      const now = performance.now();
      for (const face of doneFaces) {
        if (!selectionMarkOf(face)?.selected || now - (deselectedAt.get(face) ?? -Infinity) < DESELECT_GAP_MS) continue;
        deselectedAt.set(face, now);
        face.click();
      }
    }

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
      doneFaces = new Set([...wanted.keys()].filter((face) => faces.includes(face)));
      for (const face of stampedFaces(OWNER)) if (!wanted.has(face)) stampFace(face, OWNER, undefined);
      for (const [face, stamp] of wanted) stampFace(face, OWNER, stamp);
      deselectDone();
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      unstampAll(OWNER);
      unlockAll(OWNER);
    });
  },
};
