import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { AuctionTime, ensureMarketTileStyle, TILE_ENDED } from '@/services/market-tile';
import { onServerSecond } from '@/site/clock';
import { findSiteAuctionTiles, findTileDurations, readTileEndAt } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { createSlots } from '@/ui/mount';

/**
 * Vignettes du marché (tous les onglets) en carte standardisée : carte sans cadre, mise et durée dans un appendice
 * dessous (feuille commune avec nos vignettes, `services/market-tile`). Le compte à rebours du site (horloge du PC)
 * est caché, remplacé par notre temps restant, lu dans l'annonce (`end_at`) ; illisible, celui du site reste.
 */
export const marketplaceTiles: Feature = {
  id: 'marketplace-tiles',
  name: 'Annonces',
  description: 'Marché : cartes des annonces sans cadre, la mise et la durée dans un appendice sous la carte.',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  required: true,
  hidden: true,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ensureMarketTileStyle();

    /** Notre temps restant, par vignette. */
    const times = createSlots<HTMLElement>(signal);
    /** Compte à rebours du site caché, par vignette. */
    const countdowns = new Map<HTMLElement, HTMLElement>();
    const marks = classMarks(signal);

    function release(tile: HTMLElement): void {
      times.clear(tile);
      const countdown = countdowns.get(tile);
      if (countdown) ctx.hide(countdown, false);
      countdowns.delete(tile);
    }

    function sync(): void {
      const seen = new Set<HTMLElement>();
      for (const found of findSiteAuctionTiles()) {
        const { tile, countdown } = found;
        const endAt = readTileEndAt(found);
        if (endAt === undefined) {
          release(tile);
          continue;
        }
        seen.add(tile);
        const previous = countdowns.get(tile);
        if (previous && previous !== countdown) ctx.hide(previous, false);
        countdowns.set(tile, countdown);
        times.render(tile, h(AuctionTime, { endAt }), { parent: countdown.parentElement ?? tile, before: countdown, inline: true });
        ctx.hide(countdown);
      }
      for (const tile of times.keys()) if (!seen.has(tile)) release(tile);
      // Comptes à rebours du site restés affichés.
      marks.only(
        TILE_ENDED,
        findTileDurations()
          .filter(({ ended }) => ended)
          .map(({ element }) => element),
      );
    }

    watchDom(sync, { signal });
    // Fin repoussée par une mise de dernière minute, « Terminée » du site : leur texte change sans que watchDom le
    // voie, relus chaque seconde.
    onServerSecond(sync, { signal });
  },
};
