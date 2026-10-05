import { storedValueData, type DataSet } from '@/core/data';
import type { JsonStore } from '@/core/storage';
import { splitRarities, type ListQuery } from '@/site/list-query';
import type { Saved, SavedList } from './memory';

/** Onglet de la fenêtre Mémoire qui range les filtres retenus de toutes les listes. */
export const FILTERS_TAB = 'Filtres retenus';

/** Filtres retenus d'une liste, en clair : « Tri : … », « Raretés : L, UR », « Recherche : « rome » »… */
export function savedFiltersDetails(saved: Readonly<Record<string, unknown>>): string[] {
  const details: string[] = [];
  for (const [key, value] of Object.entries(saved)) {
    if (key === 'sort' && typeof value === 'string' && value !== '') details.push(`Tri : ${value}`);
    else if (key === 'rarities' && typeof value === 'string' && value !== '') details.push(`Raretés : ${splitRarities(value).join(', ')}`);
    else if (key === 'search' && typeof value === 'string' && value.trim() !== '') details.push(`Recherche : « ${value.trim()} »`);
    else if (key === 'tag' && typeof value === 'string' && value !== '') details.push(value === 'untagged' ? 'Sans étiquette' : 'Une étiquette');
    else if (key === 'wishlist' && value === true) details.push('Liste de souhaits');
  }
  return details.length > 0 ? details : ['Aucun filtre'];
}

interface FiltersDataOptions<T> {
  readonly id: string;
  /** Nom de la page (« Collection »). */
  readonly name: string;
  /** Clé du localStorage. */
  readonly key: string;
  readonly store: JsonStore<T>;
}

/** Les filtres retenus d'une liste, dans la fenêtre Mémoire : une ligne, « Oublier » les efface. */
export function savedFiltersData<Q extends ListQuery>({ id, name, key, store }: FiltersDataOptions<Saved<Q> | undefined>): DataSet {
  return storedValueData({
    id,
    name,
    tab: FILTERS_TAB,
    description: "Les filtres de la dernière recherche, remis à l'arrivée sur la page.",
    key,
    store,
    describe: (saved) => saved && { details: savedFiltersDetails(saved) },
  });
}

/** La dernière liste gardée d'une page (Toutes les cartes), réaffichée sans attendre le site. */
export function savedListData<Q extends ListQuery>({ id, name, key, store }: FiltersDataOptions<SavedList<Q> | undefined>): DataSet {
  return storedValueData({
    id,
    name,
    tab: FILTERS_TAB,
    description: "La dernière première page chargée, telle que le site l'a envoyée, avec ses filtres.",
    key,
    store,
    describe: (saved) => saved && { details: ['Première page', ...savedFiltersDetails(saved.filters)] },
  });
}
