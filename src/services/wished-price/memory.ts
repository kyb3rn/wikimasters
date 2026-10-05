import { jsonSize, type DataSet } from '@/core/data';
import { formatNumber } from '@/services/market';
import { allWishedPrices, importWishedPrices, removeWishedPrices, WISHED_PRICES_KEY } from './store';

/** Les prix souhaités, dans la fenêtre Mémoire (version de dev) : un par carte et par rareté, exportés. */
export const wishedPricesData: DataSet = {
  id: 'wished-prices',
  name: 'Prix souhaités',
  tab: 'Prix souhaités',
  description: 'Le prix voulu de chaque carte, par rareté (la L shiny à part).',
  storage: [WISHED_PRICES_KEY],
  large: true,
  list() {
    return Promise.resolve(
      Object.entries(allWishedPrices()).map(([key, entry]) => {
        // Clé : `<carte>:<rareté>[:shiny]`.
        const [cardId = key, rarity, shiny] = key.split(':');
        return {
          key,
          title: entry.title || cardId,
          ...(rarity !== undefined && { rarity }),
          shiny: shiny === 'shiny',
          details: [`${formatNumber(entry.price)} wb`],
          ...(entry.at > 0 && { date: entry.at }),
          bytes: jsonSize(entry),
        };
      }),
    );
  },
  remove(keys) {
    removeWishedPrices(keys);
    return Promise.resolve();
  },
  clear() {
    removeWishedPrices(Object.keys(allWishedPrices()));
    return Promise.resolve();
  },
  transfer: {
    dump: () => Promise.resolve(allWishedPrices()),
    merge: (raw, apply) => Promise.resolve(importWishedPrices(raw, apply)),
  },
};
