import type { Feature } from '@/core/runtime';
import { applyRarities, applySearch, savedFiltersStore, trackListMemory, type ApplyResult } from '@/services/list-search';
import {
  collectionList,
  findCollectionFilters,
  findCollectionSearchField,
  UNTAGGED_OPTION,
  withCollectionFilters,
  type CollectionQuery,
} from '@/site/collection';
import { findListbox } from '@/site/listbox';
import { findRarityPills } from '@/site/rarity-pills';
import { COLLECTION_ROUTE } from '@/site/routes';

const savedFilters = savedFiltersStore<CollectionQuery>('wm-collection-filters-v1', { sort: 'text', tag: 'string', search: 'string', rarities: 'string' });

/** Remet les contrôles du site aux filtres retenus : listes (par leur `onChange`), pastilles, champ de recherche. */
function applyFilters(target: CollectionQuery, signal: AbortSignal): ApplyResult {
  const filters = findCollectionFilters();
  const field = findCollectionSearchField();
  const sort = filters && findListbox(filters.sort);
  const tag = filters && findListbox(filters.tag);
  if (!field || !sort || !tag) return 'unavailable';
  let changed = false;
  if (sort.value !== target.sort && sort.options.some((option) => option.value === target.sort)) {
    sort.onChange(target.sort);
    changed = true;
  }
  const tagValue = target.tag === 'untagged' ? UNTAGGED_OPTION : target.tag;
  if (tag.value !== tagValue) {
    tag.onChange(tagValue);
    changed = true;
  }
  const pills = findRarityPills();
  if (pills && applyRarities(pills, target.rarities)) changed = true;
  // La page lance d'elle-même la recherche remise, après la frappe.
  if (applySearch(field, target.search, undefined, signal)) changed = true;
  return changed ? 'applied' : 'unchanged';
}

/**
 * Retient les filtres de la dernière liste chargée (tri, étiquette, raretés, recherche) et y revient à
 * l'arrivée sur la page : la requête par défaut ne part pas, la liste et ses compteurs sont chargés avec les
 * filtres retenus ; une fois la liste reçue, les contrôles du site y sont remis, leurs requêtes servies sans
 * réseau. La page revient en page 1.
 */
export const collectionMemory: Feature = {
  id: 'collection-memory',
  name: 'Filtres retenus',
  description: "À l'arrivée sur la collection, la liste revient aux filtres de la dernière recherche.",
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    trackListMemory({
      source: collectionList,
      signal,
      log,
      store: savedFilters,
      withFilters: withCollectionFilters,
      ready: () => true,
      apply: applyFilters,
      // La page demande toujours sa première liste.
      direct: false,
    });
  },
};
