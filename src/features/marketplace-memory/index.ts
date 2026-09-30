import { waitUntil } from '@/core/async';
import { isRecord } from '@/core/guards';
import { setReactInputValue } from '@/core/react';
import type { Feature } from '@/core/runtime';
import { jsonStore } from '@/core/storage';
import { trackListMemory, type ApplyResult, type Saved } from '@/services/list-search';
import { chooseSelectValue } from '@/site/listbox';
import {
  findMarketplaceFilters,
  isMarketplaceMineRefresh,
  MARKETPLACE_ROUTE,
  marketplaceList,
  withMarketplaceFilters,
  type MarketplaceQuery,
} from '@/site/marketplace';

type SavedFilters = Saved<MarketplaceQuery>;

export function parseSavedFilters(raw: unknown): SavedFilters | undefined {
  if (!isRecord(raw)) return undefined;
  const { sort, search, rarities } = raw;
  if (typeof sort !== 'string' || !sort || typeof search !== 'string' || typeof rarities !== 'string') return undefined;
  return { sort, search, rarities };
}

const savedFilters = jsonStore<SavedFilters | undefined>('wm-marketplace-filters-v1', undefined, parseSavedFilters);

/** Délai pour que « Rechercher » du site prenne le texte remis dans le champ. */
const SUBMIT_TIMEOUT = 2000;

/** Remet les contrôles du site aux filtres retenus (tri, raretés, puis la recherche). */
function applyFilters(target: MarketplaceQuery, signal: AbortSignal): ApplyResult {
  const filters = findMarketplaceFilters();
  if (!filters) return 'unavailable';
  let changed = false;
  if (filters.sort.value !== target.sort && [...filters.sort.options].some((option) => option.value === target.sort)) {
    chooseSelectValue(filters.sort, target.sort);
    changed = true;
  }
  const rarities = new Set(target.rarities ? target.rarities.split(',') : []);
  for (const pill of filters.pills.pills) {
    if (pill.checked === rarities.has(pill.rarity)) continue;
    pill.button.click();
    changed = true;
  }
  if (filters.field.value.trim() !== target.search) {
    setReactInputValue(filters.field, target.search);
    changed = true;
    // « Rechercher » ne s'active qu'une fois le texte pris par la page.
    const submit = () => findMarketplaceFilters()?.submit;
    void waitUntil(() => submit()?.disabled === false, { signal, timeoutMs: SUBMIT_TIMEOUT }).then((ready) => {
      if (ready) submit()?.click();
    });
  }
  return changed ? 'applied' : 'unchanged';
}

/**
 * Comme la Collection : retient les filtres de la dernière liste chargée (tri, raretés, recherche) et y revient
 * à l'arrivée sur le marché. Au retour d'une annonce, le site remet lui-même ses filtres et sa liste : on n'y
 * touche pas.
 */
export const marketplaceMemory: Feature = {
  id: 'marketplace-memory',
  name: 'Filtres retenus',
  description: "À l'arrivée sur le marché, la liste revient aux filtres de la dernière recherche.",
  category: 'Marché',
  routes: [MARKETPLACE_ROUTE],
  required: true,
  hidden: true,
  mount(ctx) {
    const { signal, log } = ctx;
    trackListMemory({
      source: marketplaceList,
      signal,
      log,
      store: savedFilters,
      withFilters: withMarketplaceFilters,
      ready: () => findMarketplaceFilters() !== undefined,
      apply: applyFilters,
      siteRestore: isMarketplaceMineRefresh,
    });
  },
};
