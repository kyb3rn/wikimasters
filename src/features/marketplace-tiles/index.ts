import { h } from 'preact';
import { classMarks, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { AuctionTime, ensureMarketTileStyle, showsEnded, TILE_ENDED } from '@/services/market-tile';
import { onServerSecond } from '@/site/clock';
import {
  findAuctionTileFaces,
  findMarketplaceTabs,
  findSiteAuctionTiles,
  findTileDurations,
  readTileEndAt,
} from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { createSlots } from '@/ui/mount';
import { STAMPS, syncStamps, unstampAll } from '@/ui/stamp';

const OWNER = 'marketplace-tiles';

/**
 * Vignettes du marché (tous les onglets) en carte standardisée : carte sans cadre, mise et durée dans un appendice
 * dessous (feuille commune avec nos vignettes, `services/market-tile`). Le compte à rebours du site (horloge du PC)
 * est caché, remplacé par notre temps restant, lu dans l'annonce (`end_at`) ; illisible, celui du site reste.
 * Une enchère finie est grisée dès qu'elle affiche « Terminée » (tampon sans texte, comme toute carte grisée), sauf
 * dans Gagnées et Historique, qui n'en listent pas d'autres ; nos vignettes (recherche avancée) aussi.
 */
export const marketplaceTiles: Feature = {
  id: 'marketplace-tiles',
  name: 'Annonces',
  description: 'Marché : cartes des annonces sans cadre, la mise et la durée dans un appendice sous la carte, grisées une fois finies.',
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
      // Comptes à rebours du site restés affichés : un caché (horloge du PC) ne doit pas griser la carte avant le nôtre.
      const hidden = new Set(countdowns.values());
      marks.only(
        TILE_ENDED,
        findTileDurations()
          .filter(({ element, ended }) => ended && !hidden.has(element))
          .map(({ element }) => element),
      );
      const active = findMarketplaceTabs()?.active;
      const pastTab = active === 'won' || active === 'history';
      syncStamps(
        OWNER,
        findAuctionTileFaces()
          .filter(({ tile, own }) => (own || !pastTab) && showsEnded(tile))
          .map(({ face }) => [face, STAMPS.greyed] as const),
      );
    }

    watchDom(sync, { signal });
    // Fin repoussée par une mise de dernière minute, « Terminée » du site : leur texte change sans que watchDom le
    // voie, relus chaque seconde.
    onServerSecond(sync, { signal });
    ctx.onDispose(() => unstampAll(OWNER));
  },
};
