import { h } from 'preact';
import { watchDom } from '@/core/dom';
import type { Feature } from '@/core/runtime';
import { onSettingsChange } from '@/core/settings';
import { trackPrices } from '@/services/market';
import { ensureMarketTileStyle, showsEnded } from '@/services/market-tile';
import { onServerSecond, serverNow } from '@/site/clock';
import { findAuctionTiles, readTileAuction } from '@/site/marketplace';
import { MARKETPLACE_ROUTE } from '@/site/routes';
import { createSlots } from '@/ui/mount';
import { DEAL_RING, DealRing, GainBadge } from './Deal';
import { settings } from './settings';
import { entryValue, interestOf, valueDetail } from './value';

const PRICE = 'wm-tile-price';

/*
 * Bouton du prix en bas de l'appendice, sous la mise et la durée. Cadre de la bonne affaire posé comme un contour
 * décalé de 1 px autour de la vignette entière (carte et appendice, arrondis de 16 px tous les deux).
 */
const CSS = `
.wm-root.${PRICE} { order: 1; align-self: stretch; margin-top: 8px; }
.${DEAL_RING} { position: absolute; inset: -3px; z-index: 2; border: 2px solid; border-radius: 19px; pointer-events: none; }
`;

/**
 * Prix sous chaque annonce du marché (tous les onglets, et nos vignettes de la recherche avancée) : revente estimée
 * d'après les ventes de la carte dans la rareté de l'exemplaire (`value.ts`), et leur nombre (`trackPrices`). Annonce
 * en cours assez intéressante (gain à la revente, moins le slot occupé) : vignette encadrée et « +gain » sur la carte,
 * dans la couleur de son intérêt (réglables).
 */
export const marketplacePrices: Feature = {
  id: 'marketplace-prices',
  name: 'Prix moyen',
  description:
    "Revente estimée d'après les meilleures ventes récentes de la carte dans sa rareté, et leur nombre. Un clic charge le prix ou l'actualise, puis ouvre l'historique des ventes.",
  toggleLabel: 'Afficher le prix moyen des annonces',
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  settings,
  async mount(ctx) {
    const { signal } = ctx;
    if (!(await ctx.ready())) return;
    ensureMarketTileStyle();
    ctx.style(CSS);

    const buttons = createSlots<HTMLElement>(signal);
    const badges = createSlots<HTMLElement>(signal);
    const rings = createSlots<HTMLElement>(signal);
    const prices = trackPrices({ signal, log: ctx.log, onChange: sync });

    function sync(): void {
      const seen = new Set<HTMLElement>();
      const marked = new Set<HTMLElement>();
      const now = serverNow();
      for (const found of findAuctionTiles()) {
        const auction = readTileAuction(found);
        if (!auction) continue;
        const { tile, column, face } = found;
        const { card, amount } = auction;
        const entry = prices.entry(card);
        const value = entry && entryValue(entry, card.rarity, now);
        // Une enchère finie ne s'achète plus : plus de bonne affaire.
        const live = auction.status === 'active' && !showsEnded(tile);
        const interest = value && live && amount !== undefined ? interestOf(value, amount, settings.get('slotHour')) : undefined;
        // Cache pas encore lu : rien, plutôt qu'un « Charger le prix » qui changerait aussitôt.
        const button = prices.button(card, value && { shown: value.value, detail: valueDetail(value, interest) });
        if (!button) continue;
        seen.add(tile);
        buttons.render(tile, button, { parent: column, className: PRICE });

        const color = interest?.color;
        if (!value || !interest || !color) continue;
        marked.add(tile);
        if (settings.get('highlight')) {
          rings.render(tile, h(DealRing, { color, dashed: value.unsure }), { parent: tile, inline: true });
        } else rings.clear(tile);
        if (settings.get('gain') && face) {
          badges.render(tile, h(GainBadge, { gain: interest.gain, color }), { parent: face, inline: true });
        } else badges.clear(tile);
      }
      buttons.prune((tile) => seen.has(tile));
      rings.prune((tile) => marked.has(tile));
      badges.prune((tile) => marked.has(tile));
    }

    onSettingsChange(sync, { signal });
    watchDom(sync, { signal });
    // Mise reçue, enchère finie, ventes qui dépassent la durée du cache ou vieillissent : relus chaque seconde.
    onServerSecond(sync, { signal });
  },
};
