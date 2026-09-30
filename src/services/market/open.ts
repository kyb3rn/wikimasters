import { h } from 'preact';
import { injectStyle } from '@/core/dom';
import { errorMessage } from '@/core/log';
import { mountUi } from '@/ui/mount';
import { toast } from '@/ui/toast';
import { cachedMarket, fetchMarket, isStale, marketUnavailable, type MarketCard } from './market';
import { MarketModal } from './MarketModal';
import { CSS } from './style';

/** Une seule à la fois : en ouvrir une autre ferme la précédente. */
let open: AbortController | undefined;

/**
 * Ouvre l'historique des ventes d'une carte, par-dessus tout (modale de carte du site comprise). Ventes du
 * cache si elles sont assez récentes, sinon demandées au site ; le site en échec, celles du cache même
 * anciennes (avec l'erreur en toast), et sans cache, l'erreur seule. Résolue une fois la modale ouverte
 * (ou l'échec montré) : l'appelant garde sa roue jusque-là.
 */
export async function openMarketModal(card: MarketCard): Promise<void> {
  const unavailable = marketUnavailable();
  if (unavailable) {
    toast.error(unavailable, { title: 'Marché' });
    return;
  }
  let entry = await cachedMarket(card.id);
  if (!entry || isStale(entry)) {
    try {
      entry = await fetchMarket(card);
    } catch (error) {
      toast.error(errorMessage(error), { title: entry ? 'Ventes non actualisées' : 'Marché indisponible' });
      if (!entry) return;
    }
  }

  open?.abort();
  const controller = new AbortController();
  open = controller;
  injectStyle('market', CSS);
  const ui = mountUi(h(MarketModal, { card, entry, onClose: () => controller.abort() }), { signal: controller.signal });
  // Le site ne voit pas les gestes faits dans la modale (clic hors d'un menu, fermeture d'une liste…).
  for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
    ui.element.addEventListener(type, (event) => event.stopPropagation());
  }
}

export function closeMarketModal(): void {
  open?.abort();
  open = undefined;
}
