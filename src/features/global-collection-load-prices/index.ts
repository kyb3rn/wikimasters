import { h } from 'preact';
import { childController } from '@/core/async';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { fetchMarket, isStale, marketNeedsPro, onSalesRateChange, salesRate, trackPrices } from '@/services/market';
import { secondsLeft } from '@/services/sales-gauge';
import { siteErrorText } from '@/site/api';
import { readFaceCard, type CardRef } from '@/site/cards';
import { onServerSecond, preciseServerNow } from '@/site/clock';
import { findGlobalCollectionFilters, findGlobalCollectionGrid } from '@/site/global-collection';
import { GLOBAL_COLLECTION_ROUTE } from '@/site/routes';
import { createSlot } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { hasRoom, loadBatch, type BatchResult } from './batch';
import { LoadPricesButton } from './LoadPricesButton';

const SLOT = 'wm-gc-load-prices';

/** Les ventes ne sont relues qu'à leur changement : une carte qui dépasse la durée du cache est recomptée à ce rythme. */
const STALE_CHECK_MS = 60_000;

const loadedText = (count: number) => `${count} prix chargé${count > 1 ? 's' : ''}`;

/**
 * Toutes les cartes : un bouton au bout de la ligne des filtres charge d'un clic les prix des cartes affichées dont
 * les ventes sont absentes du cache ou plus vieilles que sa durée (48 h), 10 à la fois au plus et 0,5 à 1 s (au hasard)
 * entre deux départs (`loadBatch`), et s'arrête avant la limite du site sur les historiques (demande de l'utilisateur,
 * 07/10/2026 : une exception à « une action = un geste », bornée par le compteur ; éteinte par défaut). Rien ne reprend seul : la minute
 * pleine, le bouton attend sa remise à zéro et un nouveau clic.
 */
export const globalCollectionLoadPrices: Feature = {
  id: 'global-collection-load-prices',
  name: 'Prix moyen',
  toggleLabel: 'Charger tous les prix d’un clic',
  description:
    "Charge les prix absents ou anciens des cartes affichées, et s'arrête avant la limite du site (30 historiques par minute).",
  category: 'Toutes les cartes',
  routes: [GLOBAL_COLLECTION_ROUTE],
  defaultOff: true,
  async mount(ctx) {
    const { signal, log } = ctx;
    if (!(await ctx.ready())) return;
    const slot = createSlot(signal);
    const prices = trackPrices({ signal, log, onChange: sync });
    let progress: { done: number; total: number } | undefined;
    /** Cartes de la grille dont le cache a été lu d'un coup. */
    let preloaded = '';
    /** Compte à rebours de la minute pleine, seconde par seconde, tant qu'il s'affiche. */
    let ticker: AbortController | undefined;

    /** Cartes de la grille, dans l'ordre, une fois chacune ; liste en chargement : `undefined`. */
    function gridCards(): CardRef[] | undefined {
      const grid = findGlobalCollectionGrid();
      if (!grid) return undefined;
      const cards = new Map<string, CardRef>();
      for (const face of grid.faces) {
        const card = readFaceCard(face);
        if (card && !cards.has(card.id)) cards.set(card.id, card);
      }
      return [...cards.values()];
    }

    /** Cartes dont les ventes sont absentes ou périmées ; cache pas encore lu pour l'une d'elles : `undefined`. */
    function staleCards(cards: readonly CardRef[]): CardRef[] | undefined {
      const stale: CardRef[] = [];
      for (const card of cards) {
        const cached = prices.cached(card);
        if (cached === undefined) return undefined;
        const entry = prices.entry(card);
        if (!entry || isStale(entry)) stale.push(card);
      }
      return stale;
    }

    function report(result: BatchResult, total: number): void {
      log.info('chargement des prix', result.end, `${result.loaded} / ${total}`, result.failed ? `${result.failed} en échec` : '');
      if (signal.aborted) return;
      if (result.end === 'refused' || result.end === 'failures') {
        toast.error(`${siteErrorText(result.error)} Chargement arrêté : ${loadedText(result.loaded)} sur ${total}.`, { title: 'Prix non chargés' });
      } else if (result.failed > 0) {
        toast.error(`${loadedText(result.loaded)} sur ${total} : le site a échoué pour ${result.failed}.`, { title: 'Prix non chargés' });
      }
    }

    async function run(): Promise<void> {
      const cards = gridCards();
      const todo = cards && staleCards(cards);
      if (progress || !todo?.length || !hasRoom(salesRate())) return;
      const total = todo.length;
      progress = { done: 0, total };
      sync();
      const result = await loadBatch(todo, {
        load: (card) => fetchMarket(card),
        room: () => hasRoom(salesRate()),
        signal,
        onProgress: (done) => {
          progress = { done, total };
          sync();
        },
      });
      progress = undefined;
      report(result, total);
      if (!signal.aborted) sync();
    }

    function tick(waiting: boolean): void {
      if (waiting && !ticker) {
        ticker = childController(signal);
        onServerSecond(sync, { signal: ticker.signal });
      } else if (!waiting && ticker) {
        ticker.abort();
        ticker = undefined;
      }
    }

    function sync(): void {
      const filters = findGlobalCollectionFilters();
      if (!filters || marketNeedsPro()) {
        tick(false);
        slot.clear();
        return;
      }
      const cards = gridCards();
      const key = cards?.map((card) => card.id).join(',') ?? '';
      if (cards && key !== preloaded) {
        preloaded = key;
        void prices.preload(cards.map((card) => card.id));
      }
      const pending = cards && staleCards(cards)?.length;
      const rate = salesRate();
      const waitSeconds = hasRoom(rate) ? undefined : secondsLeft(rate, preciseServerNow());
      tick(waitSeconds !== undefined && !progress);
      slot.render(h(LoadPricesButton, { pending, progress, waitSeconds, onClick: () => void run() }), {
        parent: filters.line,
        before: null,
        className: SLOT,
      });
    }

    watchDom(sync, { signal });
    onSalesRateChange(sync, { signal });
    const timer = setInterval(sync, STALE_CHECK_MS);
    ctx.onDispose(() => clearInterval(timer));
  },
};
