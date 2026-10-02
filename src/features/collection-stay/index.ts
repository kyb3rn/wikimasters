import { watchDom } from '@/core/dom';
import { parseJson } from '@/core/guards';
import { cacheResponse, net, replayResponse, type CachedResponse } from '@/core/net';
import type { Feature } from '@/core/runtime';
import { normalizeText } from '@/core/text';
import { markModalCard, type CardMark } from '@/services/card-marks';
import { readAuctionCreation, readDiscard } from '@/site/api';
import { findCardModals } from '@/site/cards';
import {
  findCollectionFaces,
  isBulkDiscard,
  isCollectionList,
  isCollectionStats,
  parseCollection,
  readBulkDiscard,
  readBulkDiscardFailures,
  selectionMarkOf,
  shownCollectionReply,
  type CollectionEntry,
} from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';
import { unlockAll } from '@/ui/lock';
import { STAMPS, syncStamps, unstampAll, type Stamp } from '@/ui/stamp';

const OWNER = 'collection-stay';
/** Le site recharge la liste dès la réponse de l'action : au-delà, une requête n'est plus ce rechargement. */
const QUIET_MS = 3000;
/** Réponses gardées, une par adresse (liste et compteurs, plusieurs pages ou filtres). */
const CACHE_SIZE = 8;
/** Une carte décochée par le script ne l'est pas deux fois avant que le site ait redessiné. */
const DESELECT_GAP_MS = 500;

/** Un exemplaire sur plusieurs : la carte reste dans la collection. */
function stampOf(mark: CardMark, count: number): Stamp {
  const stamp = STAMPS[mark];
  return count > 1 ? { ...stamp, label: `1 ${stamp.label.toLowerCase()}` } : stamp;
}

export const collectionStay: Feature = {
  id: 'collection-stay',
  name: 'Collection sans rechargement',
  description:
    "Après une défausse (même de toute la sélection) ou une mise aux enchères, la liste n'est pas rechargée : la carte reste, marquée « Défaussée » ou « En vente », jusqu'au prochain chargement de la liste. Elle ne se sélectionne plus.",
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    const cache = new Map<string, CachedResponse>();
    /** Exemplaires défaussés ou mis en vente depuis cette page. */
    const done = new Map<string, CardMark>();
    /** Rechargement attendu : chaque requête (liste, compteurs) n'est resservie qu'une fois. */
    let quiet: { until: number; served: Set<'list' | 'stats'> } | undefined;
    /** Dernière liste demandée, et celle affichée (sa réponse). */
    let requested: string | undefined;
    let shown: CollectionEntry[] = [];
    /** Faces de la grille d'exemplaires défaussés ou mis en vente (tamponnées). */
    let doneFaces = new Set<HTMLElement>();
    const deselectedAt = new WeakMap<HTMLElement, number>();

    function remember(href: string, cached: CachedResponse): void {
      cache.delete(href);
      cache.set(href, cached);
      for (const oldest of cache.keys()) {
        if (cache.size <= CACHE_SIZE) break;
        cache.delete(oldest);
      }
    }

    function expectReload(): void {
      quiet = { until: performance.now() + QUIET_MS, served: new Set() };
      sync();
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
        const cached = await cacheResponse(exchange);
        if (!exchange.synthetic) remember(exchange.request.url.href, cached);
        // Une réponse d'une liste abandonnée entre-temps (autre filtre) n'est pas celle affichée.
        if (!isCollectionList(exchange.request) || exchange.request.url.href !== requested) return;
        shown = parseCollection(parseJson(cached.body)) ?? [];
        sync();
      },
      { signal },
    );

    // Défausse ou mise aux enchères réussie : le rechargement qui suit reçoit la liste déjà affichée (étiquettes comprises).
    net.track(
      (request) => !request.own && (readDiscard(request) !== undefined || readAuctionCreation(request) !== undefined),
      (request) => {
        const discard = readDiscard(request);
        const id = discard?.userCardId ?? readAuctionCreation(request)?.userCardId;
        const mark: CardMark = discard ? 'discarded' : 'listed';
        return (status) => {
          if (!id || status === undefined || status >= 400) return;
          done.set(id, mark);
          expectReload();
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
          expectReload();
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
        // Avec les étiquettes posées ou retirées depuis ; état de la page illisible : le site recharge.
        const body = shownCollectionReply(request, cached.body);
        if (body === undefined) {
          log.warn('état de la page illisible : liste rechargée');
          return undefined;
        }
        quiet.served.add(kind);
        log.debug('rechargement évité', request.url.pathname + request.url.search);
        // Lue sans attendre : le voile de chargement du site n'a pas le temps d'apparaître.
        return replayResponse({ ...cached, body });
      },
      { signal },
    );

    if (!(await ctx.ready())) return;

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
          const mark = done.get(entry.id);
          const face = faces[index];
          if (mark && face && normalizeText(face.querySelector('h3')?.textContent) === normalizeText(entry.title)) {
            wanted.set(face, stampOf(mark, entry.count));
          }
        });
      }
      doneFaces = new Set(wanted.keys());
      const main = document.querySelector('main');
      if (main) syncStamps(OWNER, wanted, main);
      // Les mises en vente sont verrouillées dans la modale par auction-stay.
      const discarded = new Set(shown.filter((entry) => done.get(entry.id) === 'discarded').map((entry) => normalizeText(entry.title)));
      for (const modal of findCardModals()) markModalCard(modal, OWNER, discarded.has(normalizeText(modal.title)) ? 'discarded' : undefined);
      deselectDone();
    }

    watchDom(sync, { signal });
    ctx.onDispose(() => {
      unstampAll(OWNER);
      unlockAll(OWNER);
    });
  },
};
