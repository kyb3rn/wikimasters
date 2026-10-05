import { expose } from '@/core/expose';
import type { Feature } from '@/core/runtime';
import { cacheInfo, clearCache, closeMarketModal, marketHistoryData, marketSettings, trackMarket, trackSalesRate } from '@/services/market';

interface MarketConsole {
  /** Cartes dont les ventes sont en cache, taille approximative. */
  cache(): Promise<{ readonly cards: number; readonly bytes: number }>;
  clear(): Promise<void>;
}

declare module '@/core/expose' {
  interface WmApi {
    market?: MarketConsole;
  }
}

/**
 * Réglages communs de l'historique du marché et son cache ; chaque endroit d'où il s'ouvre (modale de
 * carte…) a sa fonctionnalité.
 */
export const market: Feature = {
  id: 'market',
  name: 'Historique du marché',
  description: "Ventes d'une carte : chiffres et graphique. Gardées sur cet appareil, redemandées au site quand elles datent.",
  category: 'Marché',
  routes: 'all',
  required: true,
  settings: marketSettings,
  data: [marketHistoryData],
  mount(ctx) {
    trackMarket();
    // Compté même compteur caché : affiché en cours de minute, il part du bon nombre.
    trackSalesRate();
    expose('market', { cache: cacheInfo, clear: clearCache }, ctx.signal);
    ctx.onDispose(closeMarketModal);
  },
};
