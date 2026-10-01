import { h, type ComponentChild } from 'preact';
import { injectStyle } from '@/core/dom';
import { siteErrorText } from '@/site/api';
import { mountUi } from '@/ui/mount';
import { toast } from '@/ui/toast';
import type { MarketEntry } from './cache';
import type { CardRef } from '@/site/cards';
import { cachedMarket, fetchMarket, isStale, marketNeedsPro } from './market';
import { MarketModal } from './MarketModal';
import { ProOffer } from './ProOffer';
import { CSS } from './style';

/** Une seule à la fois (historique ou offre PRO) : en ouvrir une autre ferme la précédente. */
let open: AbortController | undefined;

function show(render: (close: () => void) => ComponentChild): void {
  open?.abort();
  const controller = new AbortController();
  open = controller;
  injectStyle('market', CSS);
  const ui = mountUi(render(() => controller.abort()), { signal: controller.signal });
  // Le site ne voit pas les gestes faits dans la modale (clic hors d'un menu, fermeture d'une liste…).
  for (const type of ['pointerdown', 'mousedown', 'touchstart', 'click']) {
    ui.element.addEventListener(type, (event) => event.stopPropagation());
  }
}

/**
 * Ouvre l'historique des ventes d'une carte, par-dessus tout (modale de carte du site comprise). Ventes du
 * cache si elles sont assez récentes, sinon demandées au site ; le site en échec, celles du cache même
 * anciennes (avec l'erreur en toast), et sans cache, l'erreur seule. Compte sans PRO : l'offre PRO du site à
 * la place, comme lui. Résolue une fois la modale ouverte (ou l'échec montré) : l'appelant garde sa roue jusque-là.
 */
export async function openMarketModal(card: CardRef): Promise<void> {
  if (marketNeedsPro()) {
    showProOffer(card);
    return;
  }
  let entry = await cachedMarket(card.id);
  if (!entry || isStale(entry)) {
    try {
      entry = await fetchMarket(card);
    } catch (error) {
      toast.error(siteErrorText(error), { title: entry ? 'Ventes non actualisées' : 'Marché indisponible' });
      if (!entry) return;
    }
  }

  showMarketModal(card, entry);
}

/** L'historique de ces ventes-là, sans rien demander au site (« Actualiser » les redemande). */
export function showMarketModal(card: CardRef, entry: MarketEntry): void {
  show((close) => h(MarketModal, { card, entry, onClose: close }));
}

/** L'offre PRO du site à la place de l'historique, quel que soit le compte. */
export function showProOffer(card: CardRef): void {
  show((close) => h(ProOffer, { card, onClose: close }));
}

export function closeMarketModal(): void {
  open?.abort();
  open = undefined;
}
