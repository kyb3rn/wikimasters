import type { Feature } from '@/core/runtime';
import { showWishedPriceInSale } from '@/services/wished-price';

/**
 * Prix souhaité dans la fenêtre de mise en vente (version de dev, page Revente) : l'interrupteur de l'onglet Enchères.
 * La fenêtre (auction-modal) l'affiche tant que cette fonctionnalité tourne.
 */
export const auctionWishedPrice: Feature = {
  id: 'auction-wished-price',
  name: 'Prix souhaité',
  description: 'Le prix souhaité de la carte est rappelé à la mise en vente : un clic le reprend comme mise, et une autre mise peut le devenir.',
  toggleLabel: 'Afficher le prix souhaité',
  category: 'Enchères',
  routes: 'all',
  mount(ctx) {
    showWishedPriceInSale(ctx.signal);
  },
};
