import { isTypingTarget, watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { showsEnded } from '@/services/market-tile';
import { findAuctionTiles, findMarketplaceTabs } from '@/site/marketplace';
import { isSiteModalOpen } from '@/site/modals';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { isModalOpen } from '@/ui/modal';

/**
 * Enchères retirées, gardées tant que la page ne se recharge pas : au retour d'une annonce, le site remet sa liste
 * telle qu'elle était, et la recherche avancée la sienne.
 */
const wiped = new Set<string>();

/** « D » aussi en majuscules : verrouillage des majuscules actif (Maj+D, lui, reste refusé). */
const WIPE_KEYS: ReadonlySet<string> = new Set(['Delete', 'd', 'D']);

/**
 * Suppr ou D retire de la grille les enchères terminées de « Parcourir » ou de la recherche avancée, l'onglet affiché
 * (vignettes masquées : la liste du site n'est pas touchée). Elles restent visibles dans les autres onglets du site.
 */
export const marketplaceWipeEnded: Feature = {
  id: 'marketplace-wipe-ended',
  name: 'Enchères terminées',
  toggleLabel: 'Les retirer avec la touche Suppr ou D',
  description: 'Les touches Suppr et D retirent de la liste toutes les enchères terminées.',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  async mount(ctx) {
    const { signal, log } = ctx;
    if (!(await ctx.ready())) return;

    function sync(): void {
      const browsing = findMarketplaceTabs()?.active === 'browse';
      // Nos vignettes ne sont que dans la recherche avancée ; celles du site, dans tous ses onglets.
      for (const { tile, auctionId, own } of findAuctionTiles()) {
        ctx.hide(tile, auctionId !== undefined && wiped.has(auctionId) && (own || browsing));
      }
    }

    document.addEventListener(
      'keydown',
      (event) => {
        if (!WIPE_KEYS.has(event.key) || event.altKey || event.ctrlKey || event.metaKey || event.shiftKey || event.defaultPrevented) return;
        if (isTypingTarget(event.target) || isModalOpen() || isSiteModalOpen()) return;
        const tabs = findMarketplaceTabs();
        if (!tabs || (!tabs.addedActive && tabs.active !== 'browse')) return;
        // Recherche avancée choisie : le contenu de « Parcourir » est caché dessous.
        const ended = findAuctionTiles().flatMap(({ tile, auctionId, own }) =>
          auctionId !== undefined && own === tabs.addedActive && !wiped.has(auctionId) && showsEnded(tile) ? [auctionId] : [],
        );
        event.preventDefault();
        if (ended.length === 0) return;
        for (const id of ended) wiped.add(id);
        log.debug(`${ended.length} enchère(s) terminée(s) retirée(s)`);
        sync();
      },
      { signal },
    );

    watchDom(sync, { signal });
  },
};
