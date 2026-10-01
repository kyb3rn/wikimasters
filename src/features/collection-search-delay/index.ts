import type { Feature } from '@/core/runtime';
import { trackListDelay } from '@/services/list-search';
import { collectionList, LIST_LOADING_VEIL } from '@/site/collection';
import { COLLECTION_ROUTE } from '@/site/routes';

/**
 * Un changement de filtre (recherche, raretés, listes quand la recherche ne les retient pas) ne charge
 * la liste qu'après un délai sans autre changement : ses requêtes (liste et compteurs) sont retenues avant
 * le réseau, puis envoyées ; celles qu'un chargement plus récent a remplacées n'y vont jamais. La grille
 * reste telle quelle pendant l'attente : le voile du site n'apparaît qu'une fois la requête partie. Une
 * frappe dans le champ de recherche repousse l'envoi.
 */
export const collectionSearchDelay: Feature = {
  id: 'collection-search-delay',
  name: 'Recherche',
  description: "Les filtres ne chargent la liste qu'une fois les changements finis.",
  category: 'Collection',
  routes: [COLLECTION_ROUTE],
  required: true,
  hidden: true,
  mount({ signal, log }) {
    trackListDelay({ source: collectionList, signal, log, hideWhileWaiting: `main ${LIST_LOADING_VEIL}` });
  },
};
